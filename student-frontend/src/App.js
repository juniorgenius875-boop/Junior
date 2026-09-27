import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { activityApi, reportApi } from './api/client';
import { PageLoader } from './components/Loading';
import './App.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const TestCorner = lazy(() => import('./pages/TestCorner'));
const Prediction = lazy(() => import('./pages/Prediction'));
const AITutor = lazy(() => import('./pages/AITutor'));
const Login = lazy(() => import('./pages/Login'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const NAV = [
  ['/', 'Overview'],
  ['/predict', 'Performance'],
  ['/test-corner', 'Assessments'],
  ['/ai-tutor', 'Tutor'],
  ['/profile', 'Profile'],
];

function StudentActivityTracker() {
  const location = useLocation();
  useEffect(() => {
    activityApi.track('page_view', location.pathname).catch(() => {});
    const timer = setInterval(() => activityApi.track('heartbeat', location.pathname).catch(() => {}), 60000);
    return () => clearInterval(timer);
  }, [location.pathname]);
  return null;
}

function StudentNav() {
  const location = useLocation();
  return (
    <nav className="student-nav" aria-label="Student navigation">
      {NAV.map(([to, label]) => (
        <Link key={to} to={to} className={location.pathname === to ? 'active' : ''}>{label}</Link>
      ))}
    </nav>
  );
}

function StudentApp({ user, logout }) {
  const [exporting, setExporting] = useState(false);
  const exportReport = async () => {
    setExporting(true);
    try {
      await reportApi.downloadMine();
      toast.success('Report exported');
    } catch (error) {
      toast.error(error.message || 'Report export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="student-shell">
      <StudentActivityTracker />
      <header className="student-header">
        <div className="header-row">
          <Link className="brand" to="/" aria-label="Junior Genius home">
            <span className="brand-mark">JG</span>
            <span>Junior Genius</span>
          </Link>
          <StudentNav />
          <div className="header-actions">
            <button className="button secondary compact" onClick={exportReport} disabled={exporting}>{exporting ? 'Exporting…' : 'Export PDF'}</button>
            <div className="account-compact"><strong>{user?.profile?.name || 'Student'}</strong><span>{user?.email}</span></div>
            <button className="text-button" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>
      <main className="workspace">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/predict" element={<Prediction />} />
            <Route path="/test-corner" element={<TestCorner />} />
            <Route path="/ai-tutor" element={<AITutor />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div className="boot-loader"><div className="brand-mark">JG</div><div className="skeleton boot-line" /></div>;
  if (!user) return <Suspense fallback={<div className="boot-loader"><div className="skeleton boot-line" /></div>}><Login /></Suspense>;
  if (user.role === 'admin') return <Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>;
  return <StudentApp user={user} logout={logout} />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" reverseOrder={false} toastOptions={{ duration: 2800 }} />
        <AuthenticatedApp />
      </Router>
    </AuthProvider>
  );
}

export default App;
