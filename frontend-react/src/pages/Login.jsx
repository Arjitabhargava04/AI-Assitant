// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API, saveUser } from '../utils/api';

export default function Login() {
  const [tab, setTab]       = useState('login');
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
    <div className="h-full bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-bg2 border border-b1 rounded-2xl p-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center font-serif text-2xl font-semibold text-white"
               style={{ background: 'linear-gradient(135deg, #C4934A, #8B6A35)' }}>
            V
          </div>
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
