from datetime import datetime, timezone
import json
from fastapi import APIRouter, Depends, HTTPException
from pymongo import DESCENDING
from ..auth import get_current_user
from ..database import get_db
from ..schemas import ChatRequest, QuizSubmission, StudentInput, TestAnalysisRequest, TestRequest
from ..services.ml_service import ml_service
from ..services.activity_service import record_activity
from ..services.rag_service import RAGNotConfiguredError, rag_service
from ..services.tutor_orchestrator import tutor_orchestrator
from ..services.free_agent_services import gemini_direct_agent, groq_agent, openrouter_agent
from ..services.local_rag_service import local_rag_service

router = APIRouter(prefix='/api/ai', tags=['ai-rag'])


async def build_student_context(user: dict) -> str:
    db = get_db()
    latest_progress = await db.student_progress.find_one(
        {'user_id': user['_id']}, sort=[('created_at', DESCENDING)]
    )
    recent_tests = await db.test_results.find({'user_id': user['_id']}).sort('created_at', DESCENDING).limit(5).to_list(None)
    profile = user.get('profile', {})

    context = {
        'profile': {
            'grade': profile.get('grade') or 'unknown',
            'favorite_subject': profile.get('favorite_subject') or 'unknown',
            'dream_job': profile.get('dream_job') or 'unknown',
        },
        'latest_prediction': {
            k: latest_progress.get(k)
            for k in ['math_score', 'reading_score', 'writing_score', 'risk_level', 'total_predicted_marks']
        } if latest_progress else None,
        'recent_tests': [
            {
                'test_type': item.get('test_type'),
                'difficulty': item.get('difficulty'),
                'score': item.get('score'),
                'total_marks': item.get('total_marks'),
                'wrong_answers': item.get('wrong_answers', [])[:5],
            }
            for item in recent_tests
        ],
    }
    return json.dumps(context, ensure_ascii=False)


def rag_error(exc: Exception):
    if isinstance(exc, RAGNotConfiguredError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    raise HTTPException(status_code=502, detail=f'RAG service error: {exc}') from exc


@router.get('/providers')
async def ai_provider_status(current_user=Depends(get_current_user)):
    """Configuration/health hint without exposing any API keys."""
    return {
        'local_rag': {'ready': local_rag_service.ready, 'role': 'curriculum_retriever'},
        'groq': {'ready': groq_agent.ready, 'model': groq_agent.model, 'role': 'primary_fast_tutor'},
        'gemini': {'ready': gemini_direct_agent.ready, 'model': gemini_direct_agent.model, 'role': 'complex_peer_or_fallback'},
        'openrouter': {'ready': openrouter_agent.ready, 'model': openrouter_agent.model, 'role': 'free_fallback'},
    }


@router.post('/chat')
async def chat_with_tutor(request: ChatRequest, current_user=Depends(get_current_user)):
    student_context = await build_student_context(current_user)

    try:
        result = await tutor_orchestrator.chat(
            message=request.message,
            student_context=student_context,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'AI tutor error: {exc}') from exc

    now = datetime.now(timezone.utc)
    await get_db().chat_history.insert_one({
        'user_id': current_user['_id'],
        'question': request.message,
        'reply': result['text'],
        'sources': result.get('sources', []),
        'provider': result.get('provider'),
        'model': result.get('model'),
        'agents': result.get('agents', []),
        'latency_ms': result.get('latency_ms'),
        'multi_agent': result.get('multi_agent', False),
        'created_at': now,
    })
    await record_activity(
        current_user,
        'ai_question',
        '/ai-tutor',
        {
            'question_preview': request.message[:160],
            'provider': result.get('provider'),
            'agents': result.get('agents', []),
            'latency_ms': result.get('latency_ms'),
            'multi_agent': result.get('multi_agent', False),
        },
    )
    return {
        'reply': result['text'],
        'sources': result.get('sources', []),
        'provider': result.get('provider'),
        'model': result.get('model'),
        'agents': result.get('agents', []),
        'latency_ms': result.get('latency_ms'),
        'multi_agent': result.get('multi_agent', False),
    }


@router.post('/tests/generate')
async def generate_full_test(req: TestRequest, current_user=Depends(get_current_user)):
    if req.test_type == 'Assignment':
        count = 10
        subject_prompt = 'Mix of critical thinking and problem solving based on the retrieved learning material.'
    elif 'Internal' in req.test_type:
        count = 20
        subject_prompt = 'Mixed subjects: Math (8 questions), Reading (6 questions), Writing (6 questions).'
    else:
        count = 20
        subject_prompt = f'Strictly {req.test_type} questions.'

    student_context = await build_student_context(current_user)
    prompt = f"""
Create an adaptive multiple-choice test grounded in the File Search educational knowledge base.
Do not create questions about facts that are not supported by retrieved material.

Student context:
{student_context}

Frontend adaptive instruction:
{req.learning_context or 'No extra instruction provided.'}

Test requirements:
- Question count: {count}
- Focus: {subject_prompt}
- Requested difficulty: {req.difficulty}
- Grade must come from the student profile context; if unknown, use grade 5-6 level.
- Each question must have exactly four options.
- correct_answer must exactly match one option string.
- Keep wording age appropriate.

Return ONLY valid JSON with this exact top-level structure:
{{
  "questions": [
    {{
      "id": 1,
      "subject": "{req.test_type}",
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A"
    }}
  ]
}}
""".strip()

    try:
        result = await rag_service.query(prompt, expect_json=True)
        data = result['data']
        if not isinstance(data, dict) or not isinstance(data.get('questions'), list):
            raise ValueError('RAG returned invalid test JSON')
        data['sources'] = result.get('sources', [])
        return data
    except Exception as exc:
        rag_error(exc)


@router.post('/tests/analyze')
async def analyze_test_results(res: TestAnalysisRequest, current_user=Depends(get_current_user)):
    student_context = await build_student_context(current_user)
    prompt = f"""
Use the File Search learning material to analyze this student's test performance.
Student context: {student_context}
Score: {res.score}/{res.total_marks}
Wrong areas/questions: {', '.join(res.wrong_answers[:10]) or 'none supplied'}
Return ONLY JSON: {{"feedback":"...","recommendation":"...","topics_to_review":["..."]}}
""".strip()
    try:
        result = await rag_service.query(prompt, expect_json=True)
        return {**result['data'], 'sources': result.get('sources', [])}
    except Exception as exc:
        rag_error(exc)


@router.post('/study-plan')
async def generate_study_plan(student_data: StudentInput, current_user=Depends(get_current_user)):
    student_context = await build_student_context(current_user)
    scores = student_data.model_dump(by_alias=True)
    prompt = f"""
Create a practical study plan grounded in the File Search educational material.
Student context: {student_context}
Current supplied scores: {json.dumps(scores)}
Return ONLY JSON with keys: analysis, priority_topics, seven_day_plan, practice_queries.
""".strip()
    try:
        result = await rag_service.query(prompt, expect_json=True)
        return {**result['data'], 'sources': result.get('sources', [])}
    except Exception as exc:
        rag_error(exc)


@router.post('/evaluate-answer')
async def evaluate_answer(submission: QuizSubmission, current_user=Depends(get_current_user)):
    student_context = await build_student_context(current_user)
    prompt = f"""
Evaluate the student's answer using the File Search educational material as the authority.
Student context: {student_context}
Question: {submission.question}
Student answer: {submission.student_answer}
Explain whether it is correct and teach the concept briefly. Do not fabricate facts not present in retrieved material.
""".strip()
    try:
        result = await rag_service.query(prompt)
        return {'feedback': result['text'], 'sources': result.get('sources', [])}
    except Exception as exc:
        rag_error(exc)
