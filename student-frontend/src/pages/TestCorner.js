// TestCorner.js

import React, { useState, useEffect } from 'react';
import { aiApi, progressApi, testsApi } from '../api/client'; 
import { toast } from 'react-hot-toast'; 
import { 
    BookOpen, CheckCircle, XCircle, Calculator, PenTool, 
    Layers, ClipboardList, School, ArrowLeft, RefreshCw,
    ChevronLeft, ChevronRight, Zap, Target
} from 'lucide-react';

function TestCorner() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeSubject, setActiveSubject] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [testMeta, setTestMeta] = useState({ test_type: '', difficulty: '' });
  
  // NEW STATE: Adaptive Test Recommendation
  const [adaptiveRecommendation, setAdaptiveRecommendation] = useState(null);
  const [predictionLoaded, setPredictionLoaded] = useState(false); 

  // --- 1. EXAM HALL CONFIGURATION (COLORFUL KID-FRIENDLY PALETTE) ---
  const subjects = [
      { 
          id: 'math', 
          name: 'Math Test', 
          test_type: 'Math', 
          icon: <Calculator size={32}/>, color: '#0ea5e9', bg: '#e0f2fe', border: '#7dd3fc' // Sky Blue
      },
      { 
          id: 'reading', 
          name: 'Reading Test', 
          test_type: 'Reading', 
          icon: <BookOpen size={32}/>, color: '#8b5cf6', bg: '#ede9fe', border: '#c4b5fd' // Violet
      },
      { 
          id: 'writing', 
          name: 'Writing Test', 
          test_type: 'Writing', 
          icon: <PenTool size={32}/>, color: '#f59e0b', bg: '#fef3c7', border: '#fcd34d' // Amber
      },
      { 
          id: 'internal1', 
          name: 'Internal 1', 
          test_type: 'Internal 1', 
          icon: <Layers size={32}/>, color: '#10b981', bg: '#d1fae5', border: '#6ee7b7' // Emerald
      },
      { 
          id: 'internal2', 
          name: 'Internal 2', 
          test_type: 'Internal 2', 
          icon: <Layers size={32}/>, color: '#06b6d4', bg: '#cffafe', border: '#67e8f9' // Cyan
      },
      { 
          id: 'assignment', 
          name: 'Assignment', 
          test_type: 'Assignment', 
          icon: <ClipboardList size={32}/>, color: '#6366f1', bg: '#e0e7ff', border: '#a5b4fc' // Indigo
      },
  ];

  // --- 2. ADAPTIVE LOGIC ---
  const calculateAdaptiveTest = (prediction) => {
      if (!prediction) return null;
      
      const { risk_level, math_score, reading_score, writing_score } = prediction;
      
      // Scenario A: High Performer
      if (risk_level === 'Low') {
          return {
              subjectName: 'Advanced Challenge',
              test_type: 'Internal 2', // Use a mixed test type
              difficulty: 'Very Hard',
              context: 'Student is a high performer with Low Risk. Provide complex, application-based questions to challenge them.',
              reason: '🚀 You are crushing it! We curated a "Champion Level" challenge to push your limits.'
          };
      }
      
      const scores = {
          'Math': parseFloat(math_score) || 0,
          'Reading': parseFloat(reading_score) || 0,
          'Writing': parseFloat(writing_score) || 0
      };
      
      let weakestSubject = null;
      let lowestScore = 100;

      for (const [subject, score] of Object.entries(scores)) {
          if (score < lowestScore) {
              lowestScore = score;
              weakestSubject = subject;
          }
      }

      // Scenario B: Specific Weakness Identified
      if (weakestSubject && lowestScore < 65) {
          return {
              subjectName: `${weakestSubject} Booster`,
              test_type: weakestSubject,
              difficulty: 'Easy', // Start easy to build confidence
              context: `Student scored low (${lowestScore}%) in ${weakestSubject}. Focus on fundamental concepts, definitions, and easy examples to rebuild basics.`,
              reason: `💪 We noticed a dip in ${weakestSubject} (${lowestScore}%). Let's fix the basics with a quick booster session!`
          };
      }
      
      // Scenario C: Medium Performer / Average
      return {
          subjectName: 'Exam Prep Drill',
          test_type: 'Internal 1',
          difficulty: 'Medium',
          context: 'Student is performing averagely. Provide a balanced mix of conceptual and practical questions.',
          reason: '🎯 Steady progress! Here is a balanced drill to keep you exam-ready.'
      };
  };

  // --- 3. LOAD LATEST SAVED PERFORMANCE ---
  useEffect(() => {
    const fetchPredictionHistory = async () => {
      setPredictionLoaded(false);
      try {
        const data = await progressApi.latest();
        if (data) setAdaptiveRecommendation(calculateAdaptiveTest(data));
      } catch (error) {
        console.error('Error fetching prediction history:', error);
        toast.error('Could not load past performance data.');
      } finally {
        setPredictionLoaded(true);
      }
    };

    fetchPredictionHistory();
  }, []);

  // --- 4. TEST GENERATION (RESTORED LIVE API CALL) ---
  const generateTest = async (subject, difficultyOverride = null, contextOverride = null) => {
    setLoading(true);
    setQuestions([]);
    setScore(null);
    setAnswers({});
    setIsSubmitted(false);
    setActiveSubject(subject.name || subject.subjectName);
    setCurrentIndex(0);

    const difficulty = difficultyOverride || 'Hard';
    const context = contextOverride || '';
    setTestMeta({ test_type: subject.test_type, difficulty });

    const loadingToast = toast.loading(`Generating ${subject.name || subject.subjectName} from your learning library...`);

    try {
      const data = await aiApi.generateTest({
        difficulty,
        test_type: subject.test_type,
        learning_context: context
      });

      const parsedQuestions = data.questions || (Array.isArray(data) ? data : []);
      if (!parsedQuestions.length) throw new Error('No questions returned by the AI.');

      setQuestions(parsedQuestions);
      toast.dismiss(loadingToast);
      toast.success('Mission Started! 🚀');
    } catch (err) {
      console.error('Test generation error:', err);
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Could not generate test questions.');
    } finally {
      setLoading(false);
    }
  };

  const submitTest = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions first!');
      return;
    }

    let newScore = 0;
    const wrongAnswers = [];
    questions.forEach((q, index) => {
      if (answers[index] === q.correct_answer) newScore++;
      else wrongAnswers.push(q.question);
    });

    setScore(newScore);
    setIsSubmitted(true);
    setCurrentIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      await testsApi.saveResult({
        test_type: testMeta.test_type || activeSubject || 'Unknown',
        difficulty: testMeta.difficulty || 'Medium',
        score: newScore,
        total_marks: questions.length,
        wrong_answers: wrongAnswers
      });
    } catch (error) {
      console.error('Could not save test result:', error);
      toast.error('Your score is shown, but it could not be saved.');
    }

    if (newScore > questions.length / 2) toast.success(`Great job! Score: ${newScore}`);
    else toast('Keep practicing! 💪');
  };

  const handleNext = () => {
      if (currentIndex < questions.length - 1) {
          setCurrentIndex(currentIndex + 1);
      }
  };

  const handlePrev = () => {
      if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
      }
  };

  const getButtonColor = (option) => {
      const currentQ = questions[currentIndex];
      const isSelected = answers[currentIndex] === option;

      if (!isSubmitted) return isSelected ? '#e0f2fe' : 'white'; // Light Sky Blue for selection
      
      if (option === currentQ.correct_answer) return '#dcfce7'; // Green-100
      if (isSelected && option !== currentQ.correct_answer) return '#fee2e2'; // Red-100 (kept minimal for wrong answer feedback)
      return '#f8fafc'; 
  };

  const getButtonBorder = (option) => {
      const currentQ = questions[currentIndex];
      const isSelected = answers[currentIndex] === option;

      if (!isSubmitted) return isSelected ? '2px solid #0ea5e9' : '1px solid #cbd5e1'; // Sky Blue border
      
      if (option === currentQ.correct_answer) return '2px solid #22c55e'; // Green-500
      if (isSelected && option !== currentQ.correct_answer) return '2px solid #ef4444'; // Red-500
      return '1px solid #cbd5e1';
  };

  const currentQ = questions[currentIndex];

  return (
    <div className="page-container" style={{maxWidth: '800px', margin: '0 auto', paddingBottom: '50px'}}>
        
        {/* --- HEADER --- */}
        {!questions.length && (
            <div style={{textAlign: 'center', marginBottom: '40px', marginTop: '20px'}}>
                <h1 style={{fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', color: '#1e293b', marginBottom: '10px'}}>
                    <School size={40} color="#8b5cf6"/> Exam Hall
                </h1>
                <p style={{color: '#64748b', fontSize: '1.1rem'}}>Select a subject to test your knowledge.</p>
                <span style={{color: '#8b5cf6', fontWeight: 'bold'}}>All The Best!!!</span>
            </div>
        )}

        {/* --- LOADING PREDICTION DATA --- */}
        {!predictionLoaded && !questions.length && (
             <div style={{textAlign: 'center', marginTop: '50px', padding: '30px'}}>
                <div className="loader" style={{marginBottom: '20px'}}></div>
                <h2>Analyzing past performance...</h2>
                <p style={{color: '#64748b'}}>Loading your recent AI assessment from history.</p>
            </div>
        )}

        {/* --- ADAPTIVE TEST RECOMMENDATION --- */}
        {predictionLoaded && !questions.length && !loading && adaptiveRecommendation && (
            <div className="card" style={{
                marginBottom: '30px', 
                background: 'linear-gradient(to right, #e0f2fe, #f0f9ff)', // Light Blue Gradient
                border: '2px dashed #3b82f6', // Blue Border
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{position:'absolute', right:'-10px', top:'-10px', fontSize:'5rem', opacity:'0.1'}}>💡</div>
                
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom:'15px'}}>
                    <h3 style={{display:'flex', alignItems:'center', gap:'10px', marginTop:0, color:'#0369a1', fontSize:'1.4rem'}}>
                        <Target size={28} color="#0284c7"/> AI Mission Plan
                    </h3>
                    <span style={{
                        background:'#bae6fd', color:'#0369a1', padding:'5px 12px', 
                        borderRadius:'20px', fontSize:'0.85rem', fontWeight:'bold', border:'1px solid #7dd3fc'
                    }}>
                        {adaptiveRecommendation.difficulty} Mode
                    </span>
                </div>
                
                <p style={{color: '#0c4a6e', marginBottom: '20px', fontSize: '1.1rem', lineHeight: '1.5'}}>
                    {adaptiveRecommendation.reason}
                </p>

                <button 
                    onClick={() => generateTest(adaptiveRecommendation, adaptiveRecommendation.difficulty, adaptiveRecommendation.context)} 
                    className="btn-primary" 
                    style={{
                        background: '#0ea5e9', 
                        width: '100%', 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '10px',
                        padding: '14px',
                        fontSize: '1.1rem'
                    }}
                >
                    <Zap size={22} fill="white"/> Activate Mission: {adaptiveRecommendation.subjectName}
                </button>
            </div>
        )}
        
        {/* --- EXAM HALL (Subject Selection) --- */}
        {predictionLoaded && !questions.length && !loading && (
            <div style={{
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '20px', padding: '10px'
            }}>
                
                {!adaptiveRecommendation && (
                     <div style={{gridColumn: '1 / -1', textAlign: 'center', marginBottom: '10px', padding: '15px', background: '#f3e8ff', borderRadius: '10px', color: '#7c3aed'}}>
                         <p>💡 Run a **Stats & Predict** mission first to unlock personalized recommendations!</p>
                     </div>
                )}

                {subjects.map((sub) => (
                    <div key={sub.id} onClick={() => generateTest(sub, "Hard")} style={{ 
                        background: sub.bg, border: `2px solid ${sub.border}`, borderBottom: `6px solid ${sub.border}`,
                        borderRadius: '16px', padding: '30px', cursor: 'pointer', transition: 'transform 0.2s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{color: sub.color}}>{sub.icon}</div>
                        <h3 style={{margin: 0, fontSize: '1.4rem', color: '#334155'}}>{sub.name}</h3>
                        <span style={{fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b'}}>Start Exam (Manual)</span>
                    </div>
                ))}
            </div>
        )}


        {/* --- LOADING (Test Generation) --- */}
        {loading && (
            <div style={{textAlign: 'center', marginTop: '50px'}}>
                <div className="loader" style={{marginBottom: '20px'}}></div>
                <h2>Preparing {activeSubject}...</h2>
                <p style={{color:'#64748b'}}>AI is curating questions based on your profile.</p>
            </div>
        )}

        {/* --- QUESTION CARD (ONE BY ONE) --- */}
        {questions.length > 0 && currentQ && (
            <div className="card" style={{minHeight: '400px', display: 'flex', flexDirection: 'column'}}>
                
                {/* TOP BAR: Back & Progress */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                    <button onClick={() => {setQuestions([]); setScore(null);}} 
                        style={{background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', cursor: 'pointer', fontSize: '0.9rem'}}>
                        <ArrowLeft size={18}/> Quit
                    </button>
                    <span style={{fontWeight: 'bold', color: '#0ea5e9'}}>
                        Question {currentIndex + 1} / {questions.length}
                    </span>
                </div>

                {/* SCORE BANNER (Only shows after submit) */}
                {isSubmitted && (
                    <div style={{
                        background: score === questions.length ? '#dcfce7' : '#fef3c7',
                        border: score === questions.length ? '2px solid #22c55e' : '2px solid #f59e0b',
                        borderRadius: '12px', padding: '15px', textAlign: 'center', marginBottom: '20px'
                    }}>
                        <h2 style={{margin: 0, fontSize: '1.5rem', color: '#1e293b'}}>Score: {score} / {questions.length}</h2>
                        <p style={{margin: '5px 0 0', fontSize: '0.9rem', color: '#64748b'}}>Review your answers below.</p>
                    </div>
                )}

                {/* QUESTION TEXT */}
                <h3 style={{fontSize: '1.2rem', color: '#334155', marginBottom: '25px', lineHeight: '1.5'}}>
                    {currentQ.question}
                </h3>

                {/* OPTIONS LIST */}
                <div style={{display: 'grid', gap: '12px', flex: 1}}>
                    {currentQ.options.map((opt) => (
                        <button key={opt} 
                            disabled={isSubmitted} 
                            onClick={() => setAnswers({...answers, [currentIndex]: opt})}
                            style={{
                                padding: '16px', borderRadius: '12px', 
                                border: getButtonBorder(opt),
                                backgroundColor: getButtonColor(opt),
                                color: '#1e293b', textAlign: 'left', 
                                cursor: isSubmitted ? 'default' : 'pointer', fontSize: '1rem',
                                position: 'relative', transition: 'all 0.2s',
                                fontWeight: answers[currentIndex] === opt ? '600' : '400'
                            }}>
                            {opt}
                            {/* Icons for Review Mode */}
                            {isSubmitted && opt === currentQ.correct_answer && <CheckCircle size={20} color="#22c55e" style={{position:'absolute', right:'15px', top:'16px'}}/>}
                            {isSubmitted && answers[currentIndex] === opt && answers[currentIndex] !== currentQ.correct_answer && <XCircle size={20} color="#ef4444" style={{position:'absolute', right:'15px', top:'16px'}}/>}
                        </button>
                    ))}
                </div>

                {/* EXPLANATION (Only if wrong in review mode) */}
                {isSubmitted && answers[currentIndex] !== currentQ.correct_answer && (
                    <div style={{marginTop: '20px', padding: '12px', background: '#fff1f2', borderRadius: '8px', borderLeft: '4px solid #f43f5e', color: '#be123c'}}>
                        <strong>Correct Answer:</strong> {currentQ.correct_answer}
                    </div>
                )}

                {/* NAVIGATION FOOTER */}
                <div style={{marginTop: '30px', display: 'flex', justifyContent: 'space-between', gap: '15px'}}>
                    
                    {/* PREV BUTTON */}
                    <button onClick={handlePrev} disabled={currentIndex === 0}
                        style={{
                            padding: '12px 20px', borderRadius: '10px', border: '1px solid #cbd5e1',
                            background: currentIndex === 0 ? '#f1f5f9' : 'white', 
                            color: currentIndex === 0 ? '#94a3b8' : '#334155',
                            cursor: currentIndex === 0 ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}>
                        <ChevronLeft size={20}/> Prev
                    </button>

                    {/* NEXT / SUBMIT BUTTON */}
                    {currentIndex === questions.length - 1 ? (
                        !isSubmitted ? (
                            <button onClick={submitTest} className="btn-primary" 
                                style={{padding: '12px 30px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', background: '#0ea5e9'}}>
                                Submit Exam <CheckCircle size={20}/>
                            </button>
                        ) : (
                            <button onClick={() => {setQuestions([]); setScore(null);}} 
                                style={{
                                    padding: '12px 30px', borderRadius: '10px', background: '#334155', color: 'white', border: 'none',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                <RefreshCw size={18}/> New Test
                            </button>
                        )
                    ) : (
                        <button onClick={handleNext} className="btn-primary"
                            style={{padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '5px', background: '#0ea5e9'}}>
                            Next <ChevronRight size={20}/>
                        </button>
                    )}
                </div>

            </div>
        )}
    </div>
  );
}

export default TestCorner;