// Prediction.js

import React, { useState } from 'react';
import { predictionApi, progressApi } from '../api/client'; 
import { toast } from 'react-hot-toast'; 
import { 
    Save, AlertTriangle, CheckCircle, TrendingUp 
} from 'lucide-react';

// CHART COMPONENTS
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend 
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Prediction() {
  const [formData, setFormData] = useState({
    "math score": "", "reading score": "", "writing score": "",
    "Daily Study Hours": "", "Attendance (%)": "",
    "Internal Test 1 (out of 40)": "", "Internal Test 2 (out of 40)": "",
    "Assignment Score (out of 10)": ""
  });
  
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {};
    Object.keys(formData).forEach((key) => {
      payload[key] = formData[key] === '' ? null : Number(formData[key]);
    });

    try {
      const data = await predictionApi.predict(payload);
      const finalPredictionData = {
        ...data,
        math_score: payload["math score"],
        reading_score: payload["reading score"],
        writing_score: payload["writing score"],
      };

      setPrediction(finalPredictionData);
      setChartData({
        labels: ['Passing', 'You', 'Topper'],
        datasets: [{
          label: 'Marks',
          data: [40, finalPredictionData.final_marks_prediction, 95],
          backgroundColor: [
            '#CBD5E1',
            finalPredictionData.final_marks_prediction < 40 ? '#EF4444' : '#3B82F6',
            '#E2E8F0'
          ],
          borderRadius: 8,
        }]
      });
      toast.success('Prediction complete!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not connect to AI Brain.');
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async () => {
    if (!prediction) return;
    try {
      await progressApi.save({
        math_score: prediction.math_score,
        reading_score: prediction.reading_score,
        writing_score: prediction.writing_score,
        internal_test_1: formData["Internal Test 1 (out of 40)"] === '' ? null : Number(formData["Internal Test 1 (out of 40)"]),
        internal_test_2: formData["Internal Test 2 (out of 40)"] === '' ? null : Number(formData["Internal Test 2 (out of 40)"]),
        assignment_score: formData["Assignment Score (out of 10)"] === '' ? null : Number(formData["Assignment Score (out of 10)"]),
        attendance: formData["Attendance (%)"] === '' ? null : Number(formData["Attendance (%)"]),
        study_hours: formData["Daily Study Hours"] === '' ? null : Number(formData["Daily Study Hours"]),
        risk_level: prediction.risk_level,
        pass_probability: prediction.final_pass_probability,
        fail_probability: prediction.final_fail_probability,
        total_predicted_marks: prediction.final_marks_prediction
      });
      toast.success('Saved to History! Go to Exam Hall for a new mission.');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error saving data.');
    }
  };

  return (
    <div className="page-container" style={{
        maxWidth: '1200px', 
        margin: '0 auto',
        fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif",
        backgroundColor: '#FFFBEB',
        minHeight: '100vh',
        padding: '20px'
    }}>
        <header style={{textAlign: 'center', marginBottom: '30px'}}>
            <h1 style={{
                fontSize: '2rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '10px', 
                color: '#D97706',
                fontWeight: '800',
                textShadow: '1px 1px 0 #FFF'
            }}>
                <TrendingUp size={32} color="#F59E0B"/> Stats & Predict
            </h1>
            <p style={{color: '#92400E', fontSize: '1rem', fontWeight: '600'}}>AI Performance Calculator</p>
        </header>

        {/* FLEX CONTAINER: Stacks on mobile, Side-by-Side on Desktop */}
        <div style={{
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '20px', 
            alignItems: 'flex-start',
            justifyContent: 'center'
        }}>
            
            {/* --- CARD 1: INPUT FORM --- */}
            <div className="card" style={{
                flex: '1 1 350px',
                background: '#FFF',
                border: '3px solid #93C5FD', // Blue-300
                borderRadius: '25px',
                padding: '25px',
                boxShadow: '0 6px 0 #60A5FA'
            }}>
                <h3 style={{
                    marginTop: 0, 
                    color: '#1E40AF', 
                    borderBottom: '2px solid #DBEAFE', 
                    paddingBottom: '10px', 
                    marginBottom: '20px',
                    fontSize: '1.4rem',
                    fontWeight: '700'
                }}>
                    Student Metrics
                </h3>
                
                <form onSubmit={handleAnalyze}>
                    <div style={{
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        gap: '15px'
                    }}>
                        {[
                            { label: "Math", name: "math score" },
                            { label: "Reading", name: "reading score" },
                            { label: "Writing", name: "writing score" },
                            { label: "Hours/Day", name: "Daily Study Hours" },
                            { label: "Attendance %", name: "Attendance (%)" },
                            { label: "Assign. (10)", name: "Assignment Score (out of 10)" },
                            { label: "Internal 1 (40)", name: "Internal Test 1 (out of 40)" },
                            { label: "Internal 2 (40)", name: "Internal Test 2 (out of 40)" }
                        ].map((field) => (
                            <div key={field.name}>
                                <label style={{
                                    fontSize:'0.9rem', 
                                    fontWeight: '600', 
                                    color: '#4B5563', 
                                    display: 'block', 
                                    marginBottom: '6px'
                                }}>
                                    {field.label}
                                </label>
                                <input 
                                    name={field.name} 
                                    type="number" 
                                    onChange={handleChange}
                                    style={{
                                        width: '100%', 
                                        padding: '12px', 
                                        borderRadius: '12px', 
                                        border: '2px solid #E5E7EB', 
                                        fontSize: '1rem',
                                        backgroundColor: '#F9FAFB',
                                        outline: 'none',
                                        transition: 'border-color 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#60A5FA'}
                                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                                />
                            </div>
                        ))}
                    </div>

                    <button className="btn-primary" disabled={loading} style={{
                        marginTop: '25px', 
                        width: '100%', 
                        padding: '14px', 
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '10px',
                        background: '#3B82F6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 0 #1D4ED8',
                        transition: 'transform 0.1s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(2px)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        {loading ? "Calculating..." : "Predict Score"}
                    </button>
                </form>
            </div>

            {/* --- CARD 2: RESULTS (Only shows when prediction exists) --- */}
            {prediction && chartData && (
                <div className="card" style={{
                    flex: '1 1 350px',
                    background: '#F0F9FF', 
                    border: '3px solid #60A5FA',
                    borderRadius: '25px',
                    padding: '25px',
                    boxShadow: '0 6px 0 #3B82F6',
                    animation: 'fadeIn 0.5s ease-in'
                }}>
                    <h3 style={{
                        marginTop: 0, 
                        color: '#1E40AF', 
                        borderBottom: '2px solid #BFDBFE', 
                        paddingBottom: '10px', 
                        marginBottom: '20px',
                        fontSize: '1.4rem',
                        fontWeight: '700'
                    }}>
                        🤖 AI Analysis
                    </h3>
                    
                    {/* RISK BADGE */}
                    <div style={{
                        padding: '15px', borderRadius: '16px', marginBottom: '20px',
                        display: 'flex', alignItems: 'center', gap: '15px',
                        background: prediction.risk_level === 'High' ? '#FEF2F2' : '#F0FDF4',
                        border: prediction.risk_level === 'High' ? '2px solid #EF4444' : '2px solid #22C55E',
                        color: prediction.risk_level === 'High' ? '#991B1B' : '#166534',
                        boxShadow: '0 3px 0 rgba(0,0,0,0.05)'
                    }}>
                        {prediction.risk_level === 'High' ? <AlertTriangle size={28}/> : <CheckCircle size={28}/>}
                        <div>
                            <strong style={{fontSize:'1.2rem', display:'block'}}>Risk: {prediction.risk_level}</strong>
                            <span style={{fontSize:'0.9rem'}}>Based on study habits.</span>
                        </div>
                    </div>

                    {/* BIG STATS */}
                    <div style={{display: 'flex', gap: '15px', marginBottom: '20px'}}>
                        <div style={{flex: 1, background:'white', padding:'15px', borderRadius:'16px', border:'2px solid #E5E7EB', textAlign:'center'}}>
                            <div style={{color:'#6B7280', fontSize:'0.9rem', fontWeight: '600'}}>Marks</div>
                            <div style={{fontSize:'2.2rem', fontWeight:'800', color:'#3B82F6'}}>{prediction.final_marks_prediction}</div>
                        </div>
                        <div style={{flex: 1, background:'white', padding:'15px', borderRadius:'16px', border:'2px solid #E5E7EB', textAlign:'center'}}>
                            <div style={{color:'#6B7280', fontSize:'0.9rem', fontWeight: '600'}}>Chance</div>
                            <div style={{fontSize:'2.2rem', fontWeight:'800', color:'#8B5CF6'}}>{(prediction.final_pass_probability * 100).toFixed(0)}%</div>
                        </div>
                    </div>

                    {/* CHART */}
                    <div style={{height: '200px', width: '100%', marginBottom: '20px'}}>
                        <Bar 
                            data={chartData} 
                            options={{
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: { y: { beginAtZero: true, max: 100 } }
                            }}
                        />
                    </div>

                    <button onClick={saveProgress} className="btn-primary" style={{
                        width: '100%', 
                        padding: '14px',
                        background: '#4B5563',
                        color: 'white',
                        border: 'none',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 0 #1F2937',
                        transition: 'transform 0.1s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(2px)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Save size={20}/> Save Result
                    </button>
                </div>
            )}
        </div>
    </div>
  );
}
export default Prediction;