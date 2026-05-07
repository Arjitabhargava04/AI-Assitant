import { useState, useEffect, useRef } from 'react';
const audioCache = new Map();
import { authFetch, renderMarkdown } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import InputArea from '../components/InputArea';

export default function Admin() {
  const { user, logout } = useAuth();
  const isSuper = user?.isSuper;
  const [view, setView]       = useState('tuning');
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages]   = useState([]);
  const [typing, setTyping]       = useState(false);
  const msgsEndRef = useRef(null);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  async function loadSessions() {
    const res  = await authFetch('/chats');
    const data = await res.json();
    setSessions(data.chats || []);
  }

  async function newSession() {
    setView('tuning');
    setCurrentSession(null);
    setMessages([]);
  }

  async function selectSession(id, title) {
    setView('tuning');
    setCurrentSession({ id, title });
    const res  = await authFetch(`/chats/${id}/messages`);
    const data = await res.json();
    const sorted = (data.messages || []).sort((a, b) => {
      const timeDiff = new Date(a.created_at) - new Date(b.created_at);
      if (timeDiff !== 0) return timeDiff;
      if (a.role === 'user' && b.role === 'assistant') return -1;
      if (a.role === 'assistant' && b.role === 'user') return 1;
      return 0;
    });
    setMessages(sorted.map(m => ({
      id: m.id, role: m.role, content: m.content,
      geminiSummary: m.gemini_summary || '',
      fresh: false,
    })));
  }

  async function ensureSessionId(text) {
    if (currentSession?.id) return currentSession.id;
    const res  = await authFetch('/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: text.substring(0, 60) }),
    });
    const data = await res.json();
    setCurrentSession({ id: data.id, title: data.title });
    await loadSessions();
    return data.id;
  }

  async function handleSend({ text, tone, files }) {
    const hasText  = text && text.trim().length > 0;
    const hasAudio = files?.audio != null;
    const hasVideo = files?.video != null;
    const hasImage = files?.image != null;

    if (typing || (!hasText && !hasAudio && !hasVideo && !hasImage)) return;

    const userContent = hasText ? text
      : hasAudio ? '[Audio query]'
      : hasVideo ? '[Video query]'
      : '[Image query]';

    setMessages(prev => [...prev, { id: Date.now()+'_u', role: 'user', content: userContent }]);
    setTyping(true);
    const sessionId = await ensureSessionId(text);
    try {
      const fd = new FormData();
      fd.append('text', text);
      fd.append('tone', tone);
      fd.append('chat_id', sessionId);
      if (files.image) fd.append('image', files.image);
      if (files.audio) fd.append('audio', files.audio);
      if (files.video) fd.append('video', files.video);

      const res  = await authFetch('/query', { method: 'POST', body: fd });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: Date.now()+'_a', role: 'assistant',
        content: data.answer || 'No response.',
        geminiSummary: data.answer || '',
        questionText: userContent,
        tone,
        fresh: true,
      }]);
    } catch { 
      setMessages(prev => [...prev, { id: Date.now()+'_e', role: 'assistant', content: 'Error connecting.' }]);
    } finally { setTyping(false); }
  }

  async function handleRegenerate() {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const lastAiMsg   = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastUserMsg || typing) return;
    setMessages(prev => prev.filter(m => m.id !== lastAiMsg?.id));
    setTyping(true);
    try {
      const fd = new FormData();
      fd.append('text', lastUserMsg.content);
      fd.append('tone', 'normal');
      fd.append('chat_id', currentSession?.id || '');
      const res  = await authFetch('/query', { method: 'POST', body: fd });
      const data = await res.json();
      const newAnswer = data.answer || 'No response.';
      if (lastAiMsg?.id && currentSession?.id) {
        await authFetch(`/messages/${lastAiMsg.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newAnswer }),
        });
      }
      setMessages(prev => [...prev, {
        id: lastAiMsg?.id || Date.now()+'_a', role: 'assistant',
        content: newAnswer, fresh: true,
      }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now()+'_e', role: 'assistant', content: 'Error.', fresh: false }]);
    } finally { setTyping(false); }
  }

  async function handleEditSave(messageId, newText) {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newText } : m));
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAiMsg) setMessages(prev => prev.filter(m => m.id !== lastAiMsg.id));
    setTyping(true);
    try {
      const fd = new FormData();
      fd.append('text', newText);
      fd.append('tone', 'normal');
      fd.append('chat_id', currentSession?.id || '');
      const res  = await authFetch('/query', { method: 'POST', body: fd });
      const data = await res.json();
      const newAnswer = data.answer || 'No response.';
      if (lastAiMsg?.id) {
        await authFetch(`/messages/${lastAiMsg.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newAnswer }),
        });
      }
      setMessages(prev => [...prev, {
        id: lastAiMsg?.id || Date.now()+'_a', role: 'assistant',
        content: newAnswer, fresh: true,
      }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now()+'_e', role: 'assistant', content: 'Error.', fresh: false }]);
    } finally { setTyping(false); }
  }

  async function saveCorrection(geminiSummary, correctAnswer, questionText) {
    await authFetch('/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gemini_summary: geminiSummary,
        correct_answer: correctAnswer,
        question_text:  questionText || '',
      }),
    });
  }

  const navItems = isSuper
    ? [
        { id: 'tuning',       icon: '⚙️', label: 'Tuning' },
        { id: 'fixes',        icon: '🔧', label: 'Fixes' },
        { id: 'small-admins', icon: '🛡️', label: 'Small Admins' },
        { id: 'users',        icon: '👥', label: 'Users' },
      ]
    : [
        { id: 'tuning', icon: '⚙️', label: 'Tuning' },
        { id: 'fixes',  icon: '🔧', label: 'Fixes' },
      ];

  return (
    <div className="h-full flex" style={{ background: '#0D0D0D' }}>

      {/* SIDEBAR */}
      <div style={{ width: 220, flexShrink: 0, background: '#111', borderRight: '0.5px solid #222', display: 'flex', flexDirection: 'column' }}>
        
        {/* Logo */}
        <div style={{ padding: '14px 12px 10px', borderBottom: '0.5px solid #222' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#C4934A,#8B6A35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontFamily: 'serif', fontWeight: 600 }}>V</div>
            <span style={{ color: '#E8E2D9', fontSize: 13 }}>Vikramaditya <span style={{ color: '#C4934A' }}>AI</span></span>
          </div>
          <div style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, display: 'inline-block', background: isSuper ? '#2a1a00' : '#1a1a2a', color: isSuper ? '#C4934A' : '#7a7aff', border: `0.5px solid ${isSuper ? '#C4934A44' : '#7a7aff44'}`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isSuper ? 'Super Admin' : 'Small Admin'}
          </div>
          <button onClick={newSession} style={{ width: '100%', padding: '8px 12px', background: '#1a1200', border: '0.5px solid #C4934A44', borderRadius: 8, color: '#C4934A', fontSize: 12, cursor: 'pointer', textAlign: 'left', marginTop: 10 }}>
            + New Tuning Session
          </button>
        </div>

        {/* Nav */}
        <div style={{ padding: 8 }}>
          {navItems.map(item => (
            <div key={item.id} onClick={() => setView(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, color: view === item.id ? '#C4934A' : '#888', background: view === item.id ? '#1a1200' : 'none', fontSize: 12, cursor: 'pointer', marginBottom: 2 }}>
              <span>{item.icon}</span> {item.label}
            </div>
          ))}
        </div>

        {/* Sessions list */}
        <div style={{ padding: '4px 8px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 4px 6px' }}>Sessions</div>
          {sessions.map(s => (
            <div key={s.id} onClick={() => selectSession(s.id, s.title)}
              style={{ padding: '7px 10px', borderRadius: 7, color: currentSession?.id === s.id ? '#C4934A' : '#666', background: currentSession?.id === s.id ? '#1a1200' : 'none', fontSize: 11, cursor: 'pointer', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title || 'New session'}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 12px', borderTop: '0.5px solid #222' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888', flexShrink: 0 }}>👤</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#E8E2D9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || user?.email}</div>
              <div style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            </div>
            <button onClick={logout} style={{ fontSize: 10, padding: '3px 7px', border: '0.5px solid #333', borderRadius: 5, color: '#555', background: 'none', cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ padding: '12px 20px', borderBottom: '0.5px solid #1a1a1a', color: '#888', fontSize: 13, flexShrink: 0 }}>
          { view === 'tuning' ? 'Admin Tuning Interface'
          : view === 'fixes' ? 'Fixes'
          : view === 'small-admins' ? 'Small Admins'
          : 'Users' }
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {view === 'tuning' && <TuningView messages={messages} typing={typing} msgsEndRef={msgsEndRef} onSend={handleSend} onSaveCorrection={saveCorrection} isSuper={isSuper} onRegenerate={handleRegenerate} onEditSave={handleEditSave} />}
          {view === 'fixes'        && <FixesView isSuper={isSuper} userId={user?.userId} />}
          {view === 'small-admins' && isSuper && <SmallAdminsView />}
          {view === 'users'        && isSuper && <UsersView />}
        </div>
      </div>
    </div>
  );
}


// ── TUNING VIEW ───────────────────────────────────────────

function TuningView({ messages, typing, msgsEndRef, onSend, onSaveCorrection, isSuper, onRegenerate, onEditSave }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
            <div style={{ fontFamily: 'serif', fontSize: 60, color: '#222', marginBottom: 12 }}>𝑉</div>
            <div style={{ color: '#666', fontSize: 13 }}>Tuning Interface</div>
            <div style={{ color: '#444', fontSize: 11, marginTop: 6, maxWidth: 280 }}>Ask questions to test the system. Press Yes if correct, No to submit a correction.</div>
          </div>
        )}
        {messages.map((m, index) => {
          const lastUserIndex = messages.map(x => x.role).lastIndexOf('user');
          const lastAiIndex   = messages.map(x => x.role).lastIndexOf('assistant');
          const isLast = m.role === 'user'
            ? index === lastUserIndex
            : index === lastAiIndex;
          return m.role === 'user'
            ? <UserMsg key={m.id} content={m.content} messageId={m.id} isLast={isLast} onEditSave={(newText) => onEditSave && onEditSave(m.id, newText)} />
            : <AIMsg key={m.id} content={m.content} geminiSummary={m.geminiSummary} questionText={m.questionText} onSaveCorrection={onSaveCorrection} isSuper={isSuper} fresh={m.fresh} messageId={m.id} isLast={isLast} onRegenerate={onRegenerate} />;
        })}
        {typing && <TypingDots />}
        <div ref={msgsEndRef} />
      </div>
      <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
        <InputArea onSend={onSend} disabled={typing} />
      </div>
    </div>
  );
}

function UserMsg({ content, messageId, isLast, onEditSave }) {
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(content);
  const [copied, setCopied]     = useState(false);
  const [hover, setHover]       = useState(false);

  function copyText() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveEdit() {
    if (!editText.trim()) return;
    if (messageId) {
      await authFetch(`/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editText }),
      });
    }
    setEditing(false);
    onEditSave && onEditSave(editText);
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      <div style={{ maxWidth: '75%' }}>
        {editing ? (
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 12 }}>
            <textarea value={editText} onChange={e => setEditText(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#E8E2D9', fontSize: 12, resize: 'none', minHeight: 60, lineHeight: 1.6 }} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setEditing(false)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #333', background: 'none', color: '#666', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveEdit}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#C4934A', border: 'none', color: '#000', fontWeight: 500, cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: '#1a1a1a', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: 12, color: '#E8E2D9', lineHeight: 1.6 }}>
            {content}
          </div>
        )}

        {!editing && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end', opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>
            <AdminActionBtn onClick={copyText} active={copied} activeColor="#4a9a6a" title="Copy">
              <CopyIconSvg />
            </AdminActionBtn>
            {isLast && (
              <AdminActionBtn onClick={() => setEditing(true)} title="Edit">
                <EditIconSvg />
              </AdminActionBtn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AIMsg({ content, geminiSummary, questionText, onSaveCorrection, isSuper, fresh, messageId, isLast, onRegenerate }) {
  const [corrOpen, setCorrOpen]           = useState(false);
  const [corrText, setCorrText]           = useState('');
  const [saved, setSaved]                 = useState(false);
  const [markedCorrect, setMarkedCorrect] = useState(false);
  const [liked, setLiked]                 = useState(false);
  const [disliked, setDisliked]           = useState(false);
  const [copied, setCopied]               = useState(false);
  const [speakState, setSpeakState]       = useState('idle');
  const [hover, setHover]                 = useState(false);
  const audioRef = useRef(null);

  function copyText() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLike() { setLiked(l => !l); setDisliked(false); }
  function handleDislike() { setDisliked(d => !d); setLiked(false); }

  async function handleSpeak() {
    if (speakState === 'playing') {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setSpeakState('idle'); return;
    }
    if (speakState === 'loading') return;

    const cacheKey = content.substring(0, 200);

    if (audioCache.has(cacheKey)) {
      const cachedB64 = audioCache.get(cacheKey);
      const audio = new Audio('data:audio/wav;base64,' + cachedB64);
      audioRef.current = audio;
      setSpeakState('playing');
      audio.play();
      audio.onended = () => { setSpeakState('idle'); audioRef.current = null; };
      return;
    }

    setSpeakState('loading');
    try {
      const res  = await authFetch('/speak', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, voice: 'Aoede' }),
      });
      const data = await res.json();
      if (data.audio_b64) {
        audioCache.set(cacheKey, data.audio_b64);
        const audio = new Audio('data:audio/wav;base64,' + data.audio_b64);
        audioRef.current = audio;
        setSpeakState('playing');
        audio.play();
        audio.onended = () => { setSpeakState('idle'); audioRef.current = null; };
      } else throw new Error('No audio');
    } catch { setSpeakState('idle'); }
  
  }

  async function handleSave() {
    if (!corrText.trim()) return;
    await onSaveCorrection(geminiSummary || content, corrText, questionText || '');
    setSaved(true); setCorrOpen(false);
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#C4934A,#8B6A35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontFamily: 'serif', flexShrink: 0, marginTop: 2 }}>V</div>
      <div style={{ flex: 1 }}>
        <div style={{ background: '#111', border: '0.5px solid #222', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', fontSize: 12, color: '#E8E2D9', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6, opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>
          <AdminActionBtn onClick={copyText} active={copied} activeColor="#4a9a6a" title="Copy"><CopyIconSvg /></AdminActionBtn>
          <AdminActionBtn onClick={handleLike} active={liked} activeColor="#4a9a6a" title="Like"><LikeIconSvg /></AdminActionBtn>
          <AdminActionBtn onClick={handleDislike} active={disliked} activeColor="#ff4a4a" title="Dislike"><DislikeIconSvg /></AdminActionBtn>
          {speakState === 'loading' ? (
            <div style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #C4934A44', background: '#C4934A11', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <div className="dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#C4934A' }} />
              <div className="dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#C4934A', animationDelay: '0.2s' }} />
              <div className="dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#C4934A', animationDelay: '0.4s' }} />
            </div>
          ) : (
            <AdminActionBtn onClick={handleSpeak} active={speakState === 'playing'} activeColor="#C4934A" title="Read aloud">
              <SpeakIconSvg />
            </AdminActionBtn>
          )}
          {isLast && <AdminActionBtn onClick={onRegenerate} title="Regenerate"><RegenerateIconSvg /></AdminActionBtn>}
        </div>

        {/* Correct/Wrong tuning buttons */}
        {fresh && !saved && !markedCorrect && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={() => { setMarkedCorrect(true); setCorrOpen(false); setCorrText(''); }}
              style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #4a9a6a44', background: '#0a1a0a', color: '#4a9a6a', cursor: 'pointer' }}>✓ Correct</button>
            <button onClick={() => setCorrOpen(o => !o)}
              style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #ff4a4a44', background: '#1a0a0a', color: '#ff4a4a', cursor: 'pointer' }}>✗ Wrong</button>
          </div>
        )}
        {fresh && markedCorrect && <div style={{ fontSize: 10, color: '#4a9a6a', marginTop: 4 }}>✓ Answer is correct</div>}
        {fresh && saved && !corrOpen && <div style={{ fontSize: 10, color: '#C4934A', marginTop: 4 }}>✓ {isSuper ? 'Correction saved and live' : 'Correction submitted for approval'}</div>}

        {fresh && corrOpen && !saved && (
          <div style={{ marginTop: 8, padding: 12, background: '#0D0D0D', border: '0.5px solid #C4934A44', borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>Type the correct answer:</div>
            <textarea value={corrText} onChange={e => setCorrText(e.target.value)}
              placeholder="Write the correct version..."
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#E8E2D9', fontSize: 11, resize: 'none', minHeight: 70, lineHeight: 1.6 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={handleSave}
                style={{ fontSize: 11, padding: '5px 14px', borderRadius: 7, background: '#C4934A', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 500 }}>
                {isSuper ? 'Save & go live' : 'Submit for approval'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyIconSvg() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
}
function LikeIconSvg() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>;
}
function DislikeIconSvg() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>;
}
function SpeakIconSvg() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>;
}
function RegenerateIconSvg() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>;
}
function EditIconSvg() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function AdminActionBtn({ onClick, active, activeColor, title, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 26, height: 26, borderRadius: 6, border: `0.5px solid ${active ? activeColor + '44' : '#2a2a2a'}`, background: active ? activeColor + '11' : 'none', color: active ? activeColor : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
      {children}
    </button>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#C4934A,#8B6A35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontFamily: 'serif', flexShrink: 0 }}>V</div>
      <div style={{ background: '#111', border: '0.5px solid #222', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 0.2, 0.4].map((d, i) => (
          <div key={i} className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#C4934A', animationDelay: `${d}s` }} />
        ))}
      </div>
    </div>
  );
}


// ── FIXES VIEW ────────────────────────────────────────────

function FixesView({ isSuper, userId }) {
  const [corrections, setCorrections]       = useState([]);
  const [filter, setFilter]                 = useState('all');
  const [adminFilter, setAdminFilter]       = useState('all');
  const [admins, setAdmins]                 = useState([]);
  const [selected, setSelected]             = useState(null);
  const [editText, setEditText]             = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  useEffect(() => { loadCorrections(); }, []);

  async function loadCorrections() {
    const url = isSuper ? '/corrections' : '/corrections/mine';
    const res  = await authFetch(url);
    const data = await res.json();
    setCorrections(data.corrections || []);
    if (isSuper) {
      const unique = [...new Map((data.corrections || [])
        .filter(c => c.submitter_name)
        .map(c => [c.submitted_by, { id: c.submitted_by, name: c.submitter_name }]))
        .values()];
      setAdmins(unique);
    }
  }

  async function approve(id) {
    await authFetch(`/corrections/${id}/approve`, { method: 'PATCH' });
    setCorrections(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' } : c));
  }

  async function deactivate(id) {
    await authFetch(`/corrections/${id}/deactivate`, { method: 'PATCH' });
    setCorrections(prev => prev.map(c => c.id === id ? { ...c, status: 'pending' } : c));
  }

  async function deleteCorrection(id) {
    await authFetch(`/corrections/${id}`, { method: 'DELETE' });
    setCorrections(prev => prev.filter(c => c.id !== id));
    setDeleteConfirmId(null);
  }

  async function saveEdit(id) {
    await authFetch(`/corrections/${id}/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct_answer: editText }),
    });
    setCorrections(prev => prev.map(c => c.id === id ? { ...c, correct_answer: editText, status: isSuper ? 'approved' : 'pending' } : c));
    setSelected(null);
  }

  const filtered = corrections.filter(c => {
    const statusOk = filter === 'all' || c.status === filter;
    const adminOk  = adminFilter === 'all' || c.submitted_by === adminFilter;
    return statusOk && adminOk;
  });

  if (selected) {
    const c = corrections.find(x => x.id === selected);
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <button onClick={() => setSelected(null)} style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>← Back to fixes</button>
        <div style={{ background: '#111', border: '0.5px solid #222', borderRadius: 12, padding: 16, maxWidth: 640 }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Question asked</div>
          <div style={{ fontSize: 12, color: '#888', background: '#0D0D0D', borderRadius: 7, padding: '8px 10px', marginBottom: 12, lineHeight: 1.6 }}>{c?.question_text || c?.gemini_summary}</div>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>AI answer given</div>
          <div style={{ fontSize: 12, color: '#666', background: '#0D0D0D', borderRadius: 7, padding: '8px 10px', marginBottom: 12, lineHeight: 1.6, borderLeft: '2px solid #333' }}>{c?.gemini_summary}</div>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Correction {c?.submitter_name && <span style={{ color: '#C4934A' }}>by {c.submitter_name}</span>}</div>
          <textarea value={editText} onChange={e => setEditText(e.target.value)}
            style={{ width: '100%', background: '#0D0D0D', border: '0.5px solid #333', borderRadius: 7, padding: '8px 10px', color: '#4a9a6a', fontSize: 12, lineHeight: 1.6, resize: 'none', outline: 'none', minHeight: 90 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={() => setSelected(null)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: '0.5px solid #333', background: 'none', color: '#666', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => saveEdit(selected)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: '#1a1200', border: '0.5px solid #C4934A44', color: '#C4934A', cursor: 'pointer' }}>Save edit</button>
            {isSuper && c?.status === 'pending' && (
              <button onClick={() => { approve(selected); setSelected(null); }} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, background: '#4a9a6a', border: 'none', color: '#fff', cursor: 'pointer' }}>Approve</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20, position: 'relative' }}>

      {/* Delete confirmation popup */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#111', border: '0.5px solid #333', borderRadius: 12, padding: 20, width: 320 }}>
            <div style={{ fontSize: 13, color: '#E8E2D9', marginBottom: 8, fontWeight: 500 }}>Delete correction?</div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>This will permanently remove it from all views. This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '0.5px solid #333', background: 'none', color: '#666', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => deleteCorrection(deleteConfirmId)}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, background: '#ff4a4a', border: 'none', color: '#fff', fontWeight: 500, cursor: 'pointer' }}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>

        {isSuper && (
          <>
            <span style={{ fontSize: 11, color: '#666' }}>By:</span>
            <select value={adminFilter} onChange={e => setAdminFilter(e.target.value)} style={{ background: '#111', border: '0.5px solid #333', borderRadius: 6, color: '#E8E2D9', fontSize: 11, padding: '4px 8px' }}>
              <option value="all">All small admins</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </>
        )}
        <span style={{ fontSize: 11, color: '#666' }}>Status:</span>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background: '#111', border: '0.5px solid #333', borderRadius: 6, color: '#E8E2D9', fontSize: 11, padding: '4px 8px' }}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>
      </div>

      {filtered.length === 0 && <div style={{ color: '#444', fontSize: 12, textAlign: 'center', padding: 40 }}>No corrections found</div>}

      {filtered.map(c => (
        <div key={c.id} onClick={() => { setSelected(c.id); setEditText(c.correct_answer); }}
          style={{ background: '#111', border: '0.5px solid #222', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#C4934A', fontWeight: 500 }}>Q: {(c.question_text || c.gemini_summary || '').substring(0, 80)}</div>
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, flexShrink: 0, marginLeft: 8, background: c.status === 'approved' ? '#0a1a0a' : '#1a1200', color: c.status === 'approved' ? '#4a9a6a' : '#C4934A', border: `0.5px solid ${c.status === 'approved' ? '#4a9a6a44' : '#C4934A44'}` }}>
              {c.status === 'approved' ? 'Approved' : 'Pending'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#4a9a6a', lineHeight: 1.5, borderLeft: '2px solid #4a9a6a44', paddingLeft: 8 }}>{c.correct_answer.substring(0, 120)}...</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 10, color: '#444' }}>{c.submitter_name ? `by ${c.submitter_name}` : ''}</div>
            {isSuper && (
              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                {c.status === 'pending' && (
                  <button onClick={() => approve(c.id)}
                    style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #4a9a6a44', background: '#0a1a0a', color: '#4a9a6a', cursor: 'pointer' }}>
                    Approve
                  </button>
                )}
                {c.status === 'approved' && (
                  <button onClick={() => deactivate(c.id)}
                    style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #C4934A44', background: '#1a0a0a', color: '#C4934A', cursor: 'pointer' }}>
                    Deactivate
                  </button>
                )}
                <button onClick={() => setDeleteConfirmId(c.id)}
                  style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #ff4a4a44', background: '#1a0a0a', color: '#ff4a4a', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


// ── SMALL ADMINS VIEW ─────────────────────────────────────

function SmallAdminsView() {
  const [admins, setAdmins]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [profileTab, setProfileTab] = useState('corrections');
  const [profileData, setProfileData] = useState([]);
  const [email, setEmail]           = useState('');
  const [newName, setNewName]       = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');
  useEffect(() => { loadAdmins(); }, []);

  async function loadAdmins() {
    const res  = await authFetch('/admin/small-admins');
    const data = await res.json();
    setAdmins(data.admins || []);
  }

  async function createAdmin() {
    if (!newName.trim() || !email.trim() || !newPassword.trim()) {
      setCreateError('All fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }
    setCreateError('');
    try {
      const res  = await authFetch('/admin/small-admins', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:        email.trim(),
          password:     newPassword,
          display_name: newName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.detail || 'Something went wrong.');
        return;
      }
      setEmail(''); setNewName(''); setNewPassword('');
      setShowCreate(false);
      loadAdmins();
    } catch(e) {
      setCreateError('Cannot connect to server.');
    }
  }


  async function removeAdmin(id) {
    await authFetch(`/admin/small-admins/${id}`, { method: 'DELETE' });
    setAdmins(prev => prev.filter(a => a.id !== id));
  }

  async function openProfile(admin) {
    setSelected(admin);
    setProfileTab('corrections');
    await loadProfileData(admin.id, 'corrections');
  }

  async function loadProfileData(adminId, tab) {
    const url  = tab === 'corrections' ? `/admin/small-admins/${adminId}/corrections` : `/admin/small-admins/${adminId}/sessions`;
    const res  = await authFetch(url);
    const data = await res.json();
    setProfileData(data.corrections || data.sessions || []);
  }

  async function switchProfileTab(tab) {
    setProfileTab(tab);
    await loadProfileData(selected.id, tab);
  }

  async function approveFromProfile(id) {
    await authFetch(`/corrections/${id}/approve`, { method: 'PATCH' });
    setProfileData(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' } : c));
  }

  if (selected) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setSelected(null)} style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}>← Small Admins</button>
          <span style={{ color: '#333' }}>|</span>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1a2a', border: '0.5px solid #7a7aff44', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a7aff', fontSize: 11, fontWeight: 500 }}>
            {selected.display_name?.charAt(0) || '?'}
          </div>
          <span style={{ fontSize: 13, color: '#E8E2D9' }}>{selected.display_name}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {['corrections', 'sessions'].map(tab => (
            <button key={tab} onClick={() => switchProfileTab(tab)}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '0.5px solid #333', background: profileTab === tab ? '#1a1200' : 'none', color: profileTab === tab ? '#C4934A' : '#666' }}>
              {tab === 'corrections' ? `Corrections (${profileData.length})` : `Sessions (${profileData.length})`}
            </button>
          ))}
        </div>

        {profileTab === 'corrections' && profileData.map(c => (
          <div key={c.id} style={{ background: '#111', border: '0.5px solid #222', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: '#C4934A' }}>Q: {(c.question_text || c.gemini_summary || '').substring(0, 70)}</div>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: c.status === 'approved' ? '#0a1a0a' : '#1a1200', color: c.status === 'approved' ? '#4a9a6a' : '#C4934A', border: `0.5px solid ${c.status === 'approved' ? '#4a9a6a44' : '#C4934A44'}` }}>{c.status}</span>
            </div>
            <div style={{ fontSize: 11, color: '#4a9a6a', lineHeight: 1.5 }}>{c.correct_answer.substring(0, 100)}...</div>
            {c.status === 'pending' && (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => approveFromProfile(c.id)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #4a9a6a44', background: '#0a1a0a', color: '#4a9a6a', cursor: 'pointer' }}>Approve</button>
              </div>
            )}
          </div>
        ))}

        {profileTab === 'sessions' && profileData.map(s => (
          <div key={s.id} style={{ background: '#111', border: '0.5px solid #222', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: '#E8E2D9' }}>{s.title || 'Untitled session'}</div>
            <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>{new Date(s.updated_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{admins.length} small admins</div>
        <button onClick={() => setShowCreate(true)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 7, border: '0.5px solid #C4934A44', background: '#1a1200', color: '#C4934A', cursor: 'pointer' }}>+ Create Admin</button>
      </div>

      {showCreate && (
  <div style={{ background: '#111', border: '0.5px solid #C4934A44', borderRadius: 10, padding: 16, marginBottom: 14 }}>
    <div style={{ fontSize: 12, color: '#C4934A', marginBottom: 12, fontWeight: 500 }}>Create New Small Admin</div>
    
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Display Name</div>
      <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name"
        style={{ width: '100%', background: '#0D0D0D', border: '0.5px solid #333', borderRadius: 7, padding: '7px 10px', color: '#E8E2D9', fontSize: 11, outline: 'none' }} />
    </div>

    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Email</div>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@email.com" type="email"
        style={{ width: '100%', background: '#0D0D0D', border: '0.5px solid #333', borderRadius: 7, padding: '7px 10px', color: '#E8E2D9', fontSize: 11, outline: 'none' }} />
    </div>

    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Password</div>
      <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" type="password"
        style={{ width: '100%', background: '#0D0D0D', border: '0.5px solid #333', borderRadius: 7, padding: '7px 10px', color: '#E8E2D9', fontSize: 11, outline: 'none' }} />
    </div>

    {createError && (
      <div style={{ fontSize: 11, color: '#ff4a4a', marginBottom: 10, padding: '6px 10px', background: '#1a0a0a', borderRadius: 6 }}>
        {createError}
      </div>
    )}

    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button onClick={() => { setShowCreate(false); setCreateError(''); }}
        style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '0.5px solid #333', background: 'none', color: '#666', cursor: 'pointer' }}>
        Cancel
      </button>
      <button onClick={createAdmin}
        style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, background: '#C4934A', border: 'none', color: '#000', fontWeight: 500, cursor: 'pointer' }}>
        Create Admin
      </button>
    </div>
  </div>
)}

      {admins.map(a => (
        <div key={a.id} onClick={() => openProfile(a)} style={{ background: '#111', border: '0.5px solid #222', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1a1a2a', border: '0.5px solid #7a7aff44', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a7aff', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
            {a.display_name?.charAt(0) || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#E8E2D9' }}>{a.display_name}</div>
            <div style={{ fontSize: 10, color: '#555' }}>{a.email}</div>
            <div style={{ fontSize: 10, color: '#444' }}>Created {new Date(a.created_at).toLocaleDateString()}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); removeAdmin(a.id); }}
            style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #ff4a4a44', background: '#1a0a0a', color: '#ff4a4a', cursor: 'pointer' }}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}


// ── USERS VIEW ────────────────────────────────────────────

function UsersView() {
  const [users, setUsers]               = useState([]);
  const [selected, setSelected]         = useState(null);
  const [chats, setChats]               = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [roleFilter, setRoleFilter]     = useState('all');
  useEffect(() => {
    authFetch('/admin/users').then(r => r.json()).then(d => setUsers(d.users || []));
  }, []);

  const filteredUsers = roleFilter === 'all'
    ? users
    : users.filter(u => u.role === roleFilter);

  async function openChat(chat) {
    setSelectedChat(chat);
    setChatMessages([]);
    setLoadingMsgs(true);
    try {
      const res  = await authFetch(`/chats/${chat.id}/messages`);
      const data = await res.json();
      const sorted = (data.messages || []).sort((a, b) => {
        const timeDiff = new Date(a.created_at) - new Date(b.created_at);
        if (timeDiff !== 0) return timeDiff;
        if (a.role === 'user' && b.role === 'assistant') return -1;
        if (a.role === 'assistant' && b.role === 'user') return 1;
        return 0;
      });
      setChatMessages(sorted);
    } catch(e) { console.error(e); }
    finally { setLoadingMsgs(false); }
  }
  async function openUser(u) {
    setSelected(u);
    setChats([]);
    setLoadingChats(true);
    try {
      const res  = await authFetch(`/admin/users/${u.id}/chats`);
      const data = await res.json();
      setChats(data.chats || []);
    } catch(e) { console.error(e); }
    finally { setLoadingChats(false); }
  }

  if (selected && selectedChat) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 11, color: '#555' }}>
          <button onClick={() => { setSelected(null); setSelectedChat(null); }}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11 }}>
            Users
          </button>
          <span>→</span>
          <button onClick={() => setSelectedChat(null)}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11 }}>
            {selected.display_name}
          </button>
          <span>→</span>
          <span style={{ color: '#E8E2D9' }}>{selectedChat.title || 'Conversation'}</span>
        </div>

        {/* Chat title */}
        <div style={{ fontSize: 13, color: '#C4934A', marginBottom: 16, fontWeight: 500 }}>
          {selectedChat.title || 'Conversation'}
        </div>

        {loadingMsgs && <div style={{ color: '#444', fontSize: 12, padding: 20 }}>Loading messages...</div>}

        {/* Messages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {chatMessages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#C4934A,#8B6A35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontFamily: 'serif', flexShrink: 0, marginRight: 8, marginTop: 2 }}>V</div>
              )}
              <div style={{
                maxWidth: '70%',
                background: m.role === 'user' ? '#1a1a1a' : '#111',
                border: m.role === 'user' ? 'none' : '0.5px solid #222',
                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '10px 14px',
                fontSize: 12,
                color: '#E8E2D9',
                lineHeight: 1.6,
              }}>
                {m.role === 'assistant'
                  ? <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                  : m.content
                }
              </div>
              {m.role === 'user' && (
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a1a1a', border: '0.5px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 11, flexShrink: 0, marginLeft: 8, marginTop: 2 }}>👤</div>
              )}
            </div>
          ))}
        </div>

        {!loadingMsgs && chatMessages.length === 0 && (
          <div style={{ color: '#444', fontSize: 12, textAlign: 'center', padding: 30 }}>No messages</div>
        )}
      </div>
    );
  }

  if (selected) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <button onClick={() => setSelected(null)}
          style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Users
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1a1a1a', border: '0.5px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>
            {selected.display_name?.charAt(0) || '?'}
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#E8E2D9' }}>{selected.display_name}</div>
            <div style={{ fontSize: 11, color: '#555' }}>{selected.email}</div>
          </div>
        </div>

        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          {chats.length} conversations
        </div>

        {loadingChats && <div style={{ color: '#444', fontSize: 12, padding: 20 }}>Loading...</div>}

        {chats.map(c => (
          <div key={c.id} onClick={() => openChat(c)}
            style={{ background: '#111', border: '0.5px solid #222', borderRadius: 10, padding: '10px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#C4934A44'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#E8E2D9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.title || 'New conversation'}
              </div>
              <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>
                {new Date(c.updated_at).toLocaleDateString()}
              </div>
            </div>
            <span style={{ fontSize: 11, color: '#555' }}>→</span>
          </div>
        ))}

        {!loadingChats && chats.length === 0 && (
          <div style={{ color: '#444', fontSize: 12, textAlign: 'center', padding: 30 }}>
            No conversations yet
          </div>
        )}
      </div>
    );
  }


  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {filteredUsers.length} users
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#666' }}>Filter:</span>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            style={{ background: '#111', border: '0.5px solid #333', borderRadius: 6, color: '#E8E2D9', fontSize: 11, padding: '4px 8px', outline: 'none', cursor: 'pointer' }}>
            <option value="all">All</option>
            <option value="user">Users</option>
            <option value="small_admin">Small Admins</option>
            <option value="super_admin">Super Admins</option>
          </select>
        </div>
      </div>
      {filteredUsers.map(u => (
        <div key={u.id} onClick={() => openUser(u)}
          style={{ background: '#111', border: '0.5px solid #222', borderRadius: 10, padding: '10px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a9a6a', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#E8E2D9' }}>{u.display_name}</div>
            <div style={{ fontSize: 10, color: '#555' }}>{u.email}</div>
          </div>
          <div style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#1a1a1a', color: '#666' }}>
            {u.role || 'user'}
          </div>
        </div>
      ))}
    </div>
  );
}