import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { aiApi, progressApi, testsApi } from '../api/client';
import { InlineLoader, PageLoader } from '../components/Loading';

const SUBJECTS = [
  { id: 'math', name: 'Math', test_type: 'Math' },
  { id: 'reading', name: 'Reading', test_type: 'Reading' },
  { id: 'writing', name: 'Writing', test_type: 'Writing' },
  { id: 'internal1', name: 'Internal 1', test_type: 'Internal 1' },
  { id: 'internal2', name: 'Internal 2', test_type: 'Internal 2' },
  { id: 'assignment', name: 'Assignment', test_type: 'Assignment' },
];

function adaptiveFrom(prediction) {
  if (!prediction) return null;
  if ((prediction.risk_level || '').toLowerCase() === 'low') return { name: 'Advanced challenge', test_type: 'Internal 2', difficulty: 'Very Hard', context: 'High performer. Use complex application-based questions grounded in the curriculum.' };
  const scores = { Math: Number(prediction.math_score || 0), Reading: Number(prediction.reading_score || 0), Writing: Number(prediction.writing_score || 0) };
  const [weak, value] = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  if (value < 65) return { name: `${weak} booster`, test_type: weak, difficulty: 'Easy', context: `Focus on fundamentals in ${weak}; latest score ${value}.` };
  return { name: 'Exam prep', test_type: 'Internal 1', difficulty: 'Medium', context: 'Balanced conceptual and practical questions.' };
}

function TestCorner() {
  const [recommendation, setRecommendation] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [meta, setMeta] = useState({ test_type: '', difficulty: '' });

  useEffect(() => {
    progressApi.latest().then(data => setRecommendation(adaptiveFrom(data))).catch(() => setRecommendation(null)).finally(() => setInitialLoading(false));
  }, []);

  const generate = async (subject, difficulty = 'Hard', context = '') => {
    setLoading(true); setQuestions([]); setAnswers({}); setSubmitted(false); setScore(null); setCurrent(0);
    setMeta({ test_type: subject.test_type, difficulty });
    try {
      const data = await aiApi.generateTest({ difficulty, test_type: subject.test_type, learning_context: context });
      const list = data?.questions || (Array.isArray(data) ? data : []);
      if (!list.length) throw new Error('No questions returned');
      setQuestions(list);
    } catch (error) { toast.error(error.message || 'Could not generate assessment'); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (Object.keys(answers).length < questions.length) return toast.error('Answer every question before submitting');
    let correct = 0; const wrong = [];
    questions.forEach((q, i) => { if (answers[i] === q.correct_answer) correct += 1; else wrong.push(q.question); });
    setScore(correct); setSubmitted(true); setCurrent(0);
    try { await testsApi.saveResult({ test_type: meta.test_type, difficulty: meta.difficulty, score: correct, total_marks: questions.length, wrong_answers: wrong }); }
    catch (error) { toast.error(error.message || 'Score could not be saved'); }
  };

  const q = questions[current];
  const answered = Object.keys(answers).length;
  const percent = questions.length ? Math.round((answered / questions.length) * 100) : 0;
  const resultPercent = questions.length && score != null ? Math.round((score / questions.length) * 100) : null;

  if (initialLoading) return <PageLoader rows={2} />;

  if (questions.length && q) return (
    <div className="page-shell question-shell">
      <div className="page-heading"><div><h1>{meta.test_type}</h1><p>{meta.difficulty}</p></div>{submitted && <span className={`badge ${resultPercent >= 75 ? 'low' : resultPercent >= 50 ? 'medium' : 'high'}`}>{score}/{questions.length} · {resultPercent}%</span>}</div>
      <div className="panel">
        <div className="panel-body">
          <div className="question-top"><button className="text-button" onClick={() => { setQuestions([]); setScore(null); }}>Exit assessment</button><span className="question-number">Question {current + 1} of {questions.length}</span></div>
          <div className="question-progress"><i style={{ width: `${submitted ? ((current + 1) / questions.length) * 100 : percent}%` }} /></div>
          <h2 className="question-text">{q.question}</h2>
          <div className="option-list">{q.options.map(option => {
            const selected = answers[current] === option;
            let cls = selected ? 'selected' : '';
            if (submitted && option === q.correct_answer) cls = 'correct';
            else if (submitted && selected && option !== q.correct_answer) cls = 'wrong';
            return <button key={option} disabled={submitted} className={`option-button ${cls}`} onClick={() => setAnswers({ ...answers, [current]: option })}>{option}</button>;
          })}</div>
          {submitted && answers[current] !== q.correct_answer && <div className="adaptive-strip" style={{ marginTop: 16 }}><div><strong>Correct answer</strong><span>{q.correct_answer}</span></div></div>}
          <div className="question-footer">
            <button className="button secondary" disabled={current === 0} onClick={() => setCurrent(v => v - 1)}>Previous</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {current < questions.length - 1 && <button className="button primary" onClick={() => setCurrent(v => v + 1)}>Next</button>}
              {current === questions.length - 1 && !submitted && <button className="button primary" onClick={submit}>Submit</button>}
              {current === questions.length - 1 && submitted && <button className="button primary" onClick={() => { setQuestions([]); setScore(null); }}>New assessment</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-shell">
      <div className="page-heading"><div><h1>Assessments</h1></div></div>
      {loading ? <div className="panel"><div className="panel-body"><InlineLoader label="Generating assessment" /><div className="skeleton skeleton-panel" style={{ marginTop: 18 }} /></div></div> : <div className="stack">
        {recommendation && <section className="adaptive-strip"><div><strong>{recommendation.name}</strong><span>{recommendation.test_type} · {recommendation.difficulty}</span></div><button className="button primary" onClick={() => generate(recommendation, recommendation.difficulty, recommendation.context)}>Start adaptive assessment</button></section>}
        <section className="panel">
          <div className="panel-head"><h2>Assessment library</h2></div>
          <div className="panel-body"><div className="assessment-picker">{SUBJECTS.map(subject => <button className="assessment-choice" key={subject.id} onClick={() => generate(subject)}><strong>{subject.name}</strong><span>Hard</span></button>)}</div></div>
        </section>
      </div>}
    </div>
  );
}

export default TestCorner;
