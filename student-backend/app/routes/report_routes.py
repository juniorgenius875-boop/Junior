from io import BytesIO

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pymongo import DESCENDING

from ..auth import get_current_user
from ..database import get_db
from ..services.report_pdf_service import student_report_pdf

router = APIRouter(prefix='/api/reports', tags=['reports'])


def _serialize(doc: dict | None) -> dict | None:
    if not doc:
        return None
    return {
        **{k: v for k, v in doc.items() if k not in {'_id', 'user_id'}},
        'id': str(doc['_id']),
    }


@router.get('/me')
async def my_report(current_user=Depends(get_current_user)):
    """Complete structured report for the signed-in student."""
    db = get_db()
    uid = current_user['_id']

    progress = await db.student_progress.find({'user_id': uid}).sort('created_at', DESCENDING).limit(200).to_list(None)
    tests = await db.test_results.find({'user_id': uid}).sort('created_at', DESCENDING).limit(200).to_list(None)
    chats = await db.chat_history.find({'user_id': uid}).sort('created_at', DESCENDING).limit(100).to_list(None)

    percentages = [
        (row.get('score', 0) / row.get('total_marks', 1)) * 100
        for row in tests
        if row.get('total_marks', 0) > 0
    ]
    latest = progress[0] if progress else None

    return {
        'user': {
            'id': str(uid),
            'email': current_user.get('email', ''),
            'profile': current_user.get('profile', {}),
            'created_at': current_user.get('created_at'),
        },
        'summary': {
            'total_tests': len(percentages),
            'best_score': round(max(percentages), 1) if percentages else 0,
            'average_score': round(sum(percentages) / len(percentages), 1) if percentages else 0,
            'total_predictions': len(progress),
            'ai_questions': len(chats),
            'latest_risk': latest.get('risk_level') if latest else None,
            'latest_predicted_marks': latest.get('total_predicted_marks') if latest else None,
            'latest_attendance': latest.get('attendance') if latest else None,
            'latest_study_hours': latest.get('study_hours') if latest else None,
        },
        'progress': [_serialize(row) for row in progress],
        'tests': [_serialize(row) for row in tests],
        'chats': [_serialize(row) for row in chats],
    }


@router.get('/me.pdf')
async def my_report_pdf(current_user=Depends(get_current_user)):
    data = await my_report(current_user)
    pdf = student_report_pdf(data)
    name = (current_user.get('profile', {}).get('name') or 'student').strip().replace(' ', '-').lower()
    return StreamingResponse(
        BytesIO(pdf),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{name}-learning-report.pdf"'},
    )
