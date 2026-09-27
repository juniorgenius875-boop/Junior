import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { toast } from 'react-hot-toast';
import { predictionApi, progressApi } from '../api/client';
import { InlineLoader } from '../components/Loading';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const initial = {
  'math score': '', 'reading score': '', 'writing score': '',
  'Daily Study Hours': '', 'Attendance (%)': '',
  'Internal Test 1 (out of 40)': '', 'Internal Test 2 (out of 40)': '',
  'Assignment Score (out of 10)': ''
};

const fields = [
  ['Math score', 'math score', 100], ['Reading score', 'reading score', 100], ['Writing score', 'writing score', 100],
  ['Daily study hours', 'Daily Study Hours', 24], ['Attendance', 'Attendance (%)', 100], ['Assignment score', 'Assignment Score (out of 10)', 10],
  ['Internal test 1', 'Internal Test 1 (out of 40)', 40], ['Internal test 2', 'Internal Test 2 (out of 40)', 40],
];

function Prediction() {
  const [form, setForm] = useState(initial);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const analyze = async e => {
    e.preventDefault();
    setLoading(true); setSaved(false);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : Number(v)]));
    try {
      const result = await predictionApi.predict(payload);
      setPrediction({ ...result, math_score: payload['math score'], reading_score: payload['reading score'], writing_score: payload['writing score'] });
    } catch (error) { toast.error(error.message || 'Analysis failed'); }
    finally { setLoading(false); }
  };

  const save = async () => {
    if (!prediction || saved) return;
    setSaving(true);
    try {
      await progressApi.save({
        math_score: prediction.math_score,
        reading_score: prediction.reading_score,
        writing_score: prediction.writing_score,
        internal_test_1: form['Internal Test 1 (out of 40)'] === '' ? null : Number(form['Internal Test 1 (out of 40)']),
        internal_test_2: form['Internal Test 2 (out of 40)'] === '' ? null : Number(form['Internal Test 2 (out of 40)']),
        assignment_score: form['Assignment Score (out of 10)'] === '' ? null : Number(form['Assignment Score (out of 10)']),
        attendance: form['Attendance (%)'] === '' ? null : Number(form['Attendance (%)']),
        study_hours: form['Daily Study Hours'] === '' ? null : Number(form['Daily Study Hours']),
        risk_level: prediction.risk_level,
        pass_probability: prediction.final_pass_probability,
        fail_probability: prediction.final_fail_probability,
        total_predicted_marks: prediction.final_marks_prediction,
      });
      setSaved(true); toast.success('Analysis saved');
    } catch (error) { toast.error(error.message || 'Could not save analysis'); }
    finally { setSaving(false); }
  };

  const chartData = prediction ? {
    labels: ['Pass mark', 'Prediction', 'Reference'],
    datasets: [{ data: [40, prediction.final_marks_prediction, 95], backgroundColor: ['#cfd4dc', '#4f46e5', '#e4e7ec'], borderRadius: 5 }],
  } : null;

  return (
    <div className="page-shell">
      <div className="page-heading"><div><h1>Performance</h1></div></div>
      <section className="content-grid equal">
        <div className="panel">
          <div className="panel-head"><h2>Academic inputs</h2></div>
          <form className="panel-body" onSubmit={analyze}>
            <div className="form-grid">
              {fields.map(([label, name, max]) => <div className="field" key={name}><label>{label}</label><input type="number" min="0" max={max} step="0.1" name={name} value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} /></div>)}
            </div>
            <div className="form-footer"><button className="button primary" disabled={loading}>{loading ? <InlineLoader label="Analyzing" /> : 'Run analysis'}</button></div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Analysis</h2>{prediction && <span>{prediction.risk_level} risk</span>}</div>
          {!prediction ? <div className="empty-state">No analysis generated.</div> : <div className="panel-body">
            <div className="analysis-score">
              <div><span>Predicted marks</span><strong>{prediction.final_marks_prediction}</strong></div>
              <div><span>Pass probability</span><strong style={{ fontSize: 28 }}>{Math.round((prediction.final_pass_probability || 0) * 100)}%</strong></div>
            </div>
            <div className="analysis-list">
              <div><span>Risk level</span><strong>{prediction.risk_level}</strong></div>
              <div><span>Fail probability</span><strong>{Math.round((prediction.final_fail_probability || 0) * 100)}%</strong></div>
              <div><span>Math</span><strong>{prediction.math_score ?? '—'}</strong></div>
              <div><span>Reading / Writing</span><strong>{prediction.reading_score ?? '—'} / {prediction.writing_score ?? '—'}</strong></div>
            </div>
            <div style={{ height: 210, marginTop: 18 }}><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { min: 0, max: 100, grid: { color: '#eceef2' } } } }} /></div>
            <div className="form-footer"><button className="button secondary" type="button" onClick={save} disabled={saving || saved}>{saving ? 'Saving…' : saved ? 'Saved' : 'Save analysis'}</button></div>
          </div>}
        </div>
      </section>
    </div>
  );
}

export default Prediction;
