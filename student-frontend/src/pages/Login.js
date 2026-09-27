import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [signup, setSignup] = useState(false);

  const submit = async e => {
    e.preventDefault(); setLoading(true);
    try {
      if (signup) await register(email, password, name);
      else await login(email, password);
    } catch (error) { toast.error(error.message || 'Authentication failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <section className="login-brand">
        <div><div className="brand-mark">JG</div><h1>Learning data, assessments and tutoring in one workspace.</h1></div>
        <small>Junior Genius</small>
      </section>
      <section className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <h2>{signup ? 'Create account' : 'Sign in'}</h2>
          {signup && <div className="field"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} required /></div>}
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="field"><label>Password</label><input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button className="button primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>{loading ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button>
          <button type="button" className="text-button login-switch" onClick={() => setSignup(v => !v)}>{signup ? 'Use existing account' : 'Create a new account'}</button>
        </form>
      </section>
    </div>
  );
}

export default Login;
