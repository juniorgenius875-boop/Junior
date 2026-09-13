import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await register(email, password, name);
        toast.success('Account created! Welcome aboard 🚀');
      } else {
        await login(email, password);
        toast.success('Welcome back, Champ! 🦁');
      }
    } catch (error) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FFFBEB', fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif"
    }}>
      <div className="card" style={{
        maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px',
        background: '#FFF', border: '3px solid #E0E7FF', borderRadius: '30px',
        boxShadow: '0 8px 0 rgba(0,0,0,0.05)'
      }}>
        <div style={{
          width: '100px', height: '100px', background: 'white', borderRadius: '50%', margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem',
          border: '4px solid #E0F2FE', boxShadow: '0 4px 0 #E0E7FF'
        }}>🦁</div>
        <h1 style={{ color: '#3B82F6', marginBottom: '10px', fontSize: '2rem', fontWeight: '800', textShadow: '1px 1px 0 #E0E7FF' }}>
          Junior Genius
        </h1>
        <p style={{ color: '#64748B', marginBottom: '30px', fontSize: '1.1rem', fontWeight: '600' }}>
          {isSignUp ? 'Join the adventure!' : 'Welcome back, Champ!'}
        </p>

        <form onSubmit={handleAuth}>
          {isSignUp && (
            <input
              type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: '15px', width: '100%', padding: '14px', borderRadius: '15px', border: '2px solid #E2E8F0', fontSize: '1rem', outline: 'none', backgroundColor: '#F8FAFC', boxSizing: 'border-box' }}
            />
          )}
          <input
            type="email" placeholder="Email Address" required value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: '15px', width: '100%', padding: '14px', borderRadius: '15px', border: '2px solid #E2E8F0', fontSize: '1rem', outline: 'none', backgroundColor: '#F8FAFC', boxSizing: 'border-box' }}
          />
          <input
            type="password" placeholder="Password (minimum 8 characters)" required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: '25px', width: '100%', padding: '14px', borderRadius: '15px', border: '2px solid #E2E8F0', fontSize: '1rem', outline: 'none', backgroundColor: '#F8FAFC', boxSizing: 'border-box' }}
          />
          <button className="btn-primary" disabled={loading} style={{
            width: '100%', padding: '14px', fontSize: '1.1rem', fontWeight: '700', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer', boxShadow: '0 4px 0 #1D4ED8'
          }}>
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
          </button>
        </form>

        <p style={{ marginTop: '25px', fontSize: '1rem', color: '#64748B', cursor: 'pointer', fontWeight: '600' }} onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
        </p>
      </div>
    </div>
  );
}

export default Login;
