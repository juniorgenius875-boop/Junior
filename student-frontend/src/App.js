import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, BookOpen, Sparkles, LineChart, LogOut } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import TestCorner from './pages/TestCorner';
import Prediction from './pages/Prediction';
import AITutor from './pages/AITutor';
import Login from './pages/Login';
import './App.css';

function NavItem({ to, icon, label }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <li>
      <Link to={to} className={isActive ? 'active' : ''}>
        <div className="nav-icon">{icon}</div>
        <span className="nav-label">{label}</span>
      </Link>
    </li>
  );
}

function AuthenticatedApp() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading Junior Genius... 🦁</div>;
  }

  if (!user) return <Login />;

  return (
    <div className="app-layout">
      <header className="mobile-top-bar">
        <div className="logo-mobile">🦁 Junior Genius</div>
        <button className="logout-icon-mobile" onClick={logout}>
          <LogOut size={20} color="#ef4444" />
        </button>
      </header>

      <nav className="sidebar">
        <div className="logo-desktop">🦁 Junior Genius</div>
        <ul className="nav-links">
          <NavItem to="/" icon={<LayoutDashboard size={24} />} label="Home" />
          <NavItem to="/profile" icon={<User size={24} />} label="Profile" />
          <NavItem to="/predict" icon={<LineChart size={24} />} label="Stats" />
          <NavItem to="/test-corner" icon={<BookOpen size={24} />} label="Tests" />
          <NavItem to="/ai-tutor" icon={<Sparkles size={24} />} label="AI" />
        </ul>
        <button className="logout-btn-desktop" onClick={logout}>
          <LogOut size={20} /> <span className="nav-label">Log Out</span>
        </button>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/predict" element={<Prediction />} />
          <Route path="/test-corner" element={<TestCorner />} />
          <Route path="/ai-tutor" element={<AITutor />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-center" reverseOrder={false} />
        <AuthenticatedApp />
      </Router>
    </AuthProvider>
  );
}

export default App;
