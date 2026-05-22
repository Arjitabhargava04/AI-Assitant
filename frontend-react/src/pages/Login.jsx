// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API, saveUser } from '../utils/api';

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const [tab, setTab]       = useState(initialTab);
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [name, setName]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser }         = useAuth();
  const navigate            = useNavigate();

  async function submit() {
    if (!email || !pass) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError('');
    try {
      const url  = tab === 'login' ? '/auth/login' : '/auth/signup';
      const body = tab === 'login'
        ? { email, password: pass }
        : { email, password: pass, display_name: name };

      const res  = await fetch(API + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Something went wrong.'); return; }

      saveUser(data);
setUser({ token: data.token, email: data.email, name: data.display_name, isAdmin: data.is_admin, isSuper: data.is_super, role: data.role });
navigate(data.is_admin ? '/admin' : '/chat', { replace: true });
    } catch {
      setError('Cannot connect to server. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover z-0"
      >
        <source src="/login-video.mp4" type="video/mp4" />
      </video>

      {/* 65% dark overlay */}
      <div className="fixed top-0 left-0 w-full h-full bg-black/80 z-15"></div>

      {/* Back to chat link (for guests who don't want to login) */}
      <button
        onClick={() => navigate('/chat')}
        className="absolute top-4 left-4 text-xs text-t3 hover:text-accent transition-colors flex items-center gap-1.5 z-20"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12"/>
          <polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to chat
      </button>

      <div className="w-full max-w-sm bg-bg2/90 backdrop-blur-md border border-b1 rounded-2xl p-6 sm:p-10 relative z-20">

        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Vikramaditya AI"
            className="w-20 h-20 mx-auto mb-3"
            style={{ filter: 'drop-shadow(0 8px 20px rgba(196,147,74,0.35))' }}
          />
          <div className="font-serif text-2xl font-semibold text-t1">
            Vikramaditya <span className="text-accent">AI</span>
          </div>
          <div className="text-xs text-t3 uppercase tracking-widest mt-1">
            Heritage &amp; Archaeology
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border border-b2 rounded-lg overflow-hidden mb-6">
          {['login', 'signup'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2.5 text-sm transition-all ${
                tab === t ? 'bg-ag text-accent' : 'text-t2 hover:text-t1'
              }`}>
              {t === 'login' ? 'Login' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-lg text-sm text-danger">
            {error}
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4">
          {tab === 'signup' && (
            <Field label="Display Name" type="text" value={name}
              onChange={e => setName(e.target.value)} placeholder="Your name" />
          )}
          <Field label="Email" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
          <Field label="Password" type="password" value={pass}
            onChange={e => setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        <button onClick={submit} disabled={loading}
          className="w-full mt-6 py-3 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: loading ? '#8B6A35' : 'linear-gradient(135deg,#C4934A,#8B6A35)' }}>
          {loading ? 'Please wait...' : tab === 'login' ? 'Login' : 'Create Account'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-t2 mb-1.5">{label}</label>
      <input {...props}
        className="w-full px-3.5 py-2.5 bg-bg3 border border-b2 rounded-lg text-t1 text-sm outline-none transition-colors focus:border-accent placeholder:text-t3"
      />
    </div>
  );
}
