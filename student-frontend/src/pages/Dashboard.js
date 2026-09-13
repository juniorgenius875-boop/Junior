import React, { useEffect, useState } from 'react';
import { progressApi } from '../api/client';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Trophy, TrendingUp, Zap } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function Dashboard() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await progressApi.list(200);
      setHistory([...(data || [])].reverse());
    } catch (error) {
      console.error('Error loading progress history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const data = {
    labels: history.map(item => new Date(item.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'})),
    datasets: [{
      label: 'My XP Points 🚀',
      data: history.map(item => item.total_predicted_marks),
      borderColor: '#F59E0B', // Amber-500
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      tension: 0.4,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: '#FFF',
      pointBorderColor: '#F59E0B',
      pointBorderWidth: 2,
      fill: true
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
        legend: { 
            labels: { 
                font: { family: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif", size: 14 } 
            } 
        },
        tooltip: {
            backgroundColor: '#FFF',
            titleColor: '#333',
            bodyColor: '#666',
            borderColor: '#E5E7EB',
            borderWidth: 1,
            titleFont: { family: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif" },
            bodyFont: { family: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif" }
        }
    },
    scales: {
        x: { 
            grid: { display: false },
            ticks: { font: { family: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif" } }
        },
        y: { 
            grid: { borderDash: [5, 5], color: '#E5E7EB' }, 
            beginAtZero: true, 
            max: 100,
            ticks: { font: { family: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif" } }
        }
    }
  };

  if (loading) return (
    <div className="page-container" style={{
        textAlign:'center', paddingTop:'50px',
        fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif"
    }}>
        <h2>Loading Mission Control... 🛸</h2>
    </div>
  );

  return (
    <div className="page-container" style={{
        fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif",
        backgroundColor: '#FFFBEB', // Consistent warm background
        minHeight: '100vh',
        padding: '20px'
    }}>
      <header style={{marginBottom: '30px', textAlign: 'center'}}>
        <h1 style={{
            fontSize: '2.5rem', 
            marginBottom: '5px', 
            color: '#D97706', // Dark Amber
            fontWeight: '800',
            textShadow: '1px 1px 0 #FFF'
        }}>
            🚀 Mission Control
        </h1>
        <p style={{
            color: '#92400E', 
            fontSize: '1.1rem',
            fontWeight: '600'
        }}>
            Ready to learn something new today?
        </p>
      </header>
      
      {/* 3 Color-Coded Cards */}
      <div className="stats-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
      }}>
        <div className="stat-card" style={{
            background: '#FFF',
            border: '2px solid #FCD34D', // Amber-300
            borderRadius: '20px',
            padding: '20px',
            textAlign: 'center',
            boxShadow: '0 4px 0 #F59E0B'
        }}>
            <Trophy size={40} color="#F59E0B" style={{marginBottom:'10px', display: 'inline-block'}}/>
            <h3 style={{color: '#78350F', fontSize: '1.2rem', marginBottom: '5px'}}>Total Missions</h3>
            <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#D97706', margin: 0}}>{history.length}</p>
        </div>
        <div className="stat-card" style={{
            background: '#FFF',
            border: '2px solid #86EFAC', // Green-300
            borderRadius: '20px',
            padding: '20px',
            textAlign: 'center',
            boxShadow: '0 4px 0 #22C55E'
        }}>
            <TrendingUp size={40} color="#22C55E" style={{marginBottom:'10px', display: 'inline-block'}}/>
            <h3 style={{color: '#14532D', fontSize: '1.2rem', marginBottom: '5px'}}>High Score</h3>
            <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#16A34A', margin: 0}}>
                {history.length > 0 ? Math.max(...history.map(h => h.total_predicted_marks || 0)) : 0}
            </p>
        </div>
        <div className="stat-card" style={{
            background: '#FFF',
            border: '2px solid #F9A8D4', // Pink-300
            borderRadius: '20px',
            padding: '20px',
            textAlign: 'center',
            boxShadow: '0 4px 0 #EC4899'
        }}>
            <Zap size={40} color="#EC4899" style={{marginBottom:'10px', display: 'inline-block'}}/>
            <h3 style={{color: '#831843', fontSize: '1.2rem', marginBottom: '5px'}}>Power Level</h3>
            <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#DB2777', margin: 0}}>
                {history.length > 0 ? "Level " + Math.floor(history.length / 2 + 1) : "Level 1"}
            </p>
        </div>
      </div>

      <div className="card chart-container" style={{
          height: '450px',
          background: '#FFF',
          border: '3px solid #E5E7EB',
          borderRadius: '25px',
          padding: '20px',
          boxShadow: '0 8px 0 #D1D5DB'
      }}>
        <h2 style={{
            marginBottom: '20px', 
            color: '#4B5563', 
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: '700'
        }}>
            📈 XP Growth Chart
        </h2>
        <div style={{height: '350px'}}>
            {history.length > 0 ? <Line data={data} options={chartOptions}/> : 
            <div style={{textAlign:'center', padding:'50px', color:'#9CA3AF'}}>
                <p style={{fontSize: '1.2rem'}}>No missions completed yet!</p>
                <p>Go to <strong>Check Stats</strong> to start your first mission.</p>
            </div>}
        </div>
      </div>
    </div>
  );
}
export default Dashboard;