// src/pages/Admin.jsx
import { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/api';
import Sidebar from '../components/Sidebar';
import InputArea from '../components/InputArea';
import { UserBubble, AIBubble, TypingIndicator } from '../components/MessageBubble';

const TABS = ['Tuning', 'Users', 'Fixes'];

export default function Admin() {
  const [chats, setChats]               = useState([]);
  const [allChats, setAllChats]         = useState([]);
  const [corrections, setCorrections]   = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [typing, setTyping]             = useState(false);
  const [sideTab, setSideTab]           = useState('Tuning');
  const msgsEndRef = useRef(null);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  async function loadAll() {
    await Promise.all([loadChats(), loadAllChats(), loadCorrections()]);
  }

  async function loadChats() {
    try {
      const res  = await authFetch('/chats');
      const data = await res.json();
      setChats(data.chats || []);
    } catch(e) { console.error(e); }
  }

  async function loadAllChats() {
    try {
      const res  = await authFetch('/chats/all');
      const data = await res.json();
      setAllChats(data.chats || []);
    } catch(e) { console.error(e); }
  }

  async function loadCorrections() {
    try {
      const res  = await authFetch('/corrections');
      const data = await res.json();
      setCorrections(data.corrections || []);
    } catch(e) { console.error(e); }
  }

  async function deactivate(id) {
    if (!confirm('Deactivate this correction?')) return;
    try {
      await authFetch(`/corrections/${id}/deactivate`, { method: 'PATCH' });
      setCorrections(prev => prev.filter(c => c.id !== id));
    } catch(e) { alert('Failed.'); }
  }

  async function selectChat(chatId, title) {
    setCurrentChatId(chatId);
    try {
      const res  = await authFetch(`/chats/${chatId}/messages`);
      const data = await res.json();
      const sorted = (data.messages || []).sort((a, b) => {
  const timeDiff = new Date(a.created_at) - new Date(b.created_at);
  if (timeDiff !== 0) return timeDiff;
  if (a.role === 'user' && b.role === 'assistant') return -1;
  if (a.role === 'assistant' && b.role === 'user') return 1;
  return 0;
});
      setMessages(sorted.map(m => ({
        id:             m.id,
        role:           m.role,
        content:        m.content,
        geminiSummary:  m.gemini_summary || '',
        tone:           'normal',
        showCorrection: false,
      })));
    } catch(e) { console.error(e); }
  }

  function newChat() {
    setCurrentChatId(null);
    setMessages([]);
  }

  async function ensureChatId(firstMsg) {
    if (currentChatId) return currentChatId;
    try {
      const res  = await authFetch('/chats', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: (firstMsg || 'Tuning session').substring(0, 60) }),
      });
      const data = await res.json();
      setCurrentChatId(data.id);
      await loadChats();
      return data.id;
    } catch(e) { console.error(e); return ''; }
  }

  async function handleSend({ text, tone, files, prevUrls }) {
    if (typing) return;

    const userMsg = {
      id:        Date.now() + '_u',
      role:      'user',
      content:   text,
      imageUrl:  prevUrls.image || null,
      audioName: files.audio?.name || null,
      videoName: files.video?.name || null,
    };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    const chatId = await ensureChatId(text);

    try {
      const fd = new FormData();
      fd.append('text', text); fd.append('tone', tone); fd.append('chat_id', chatId);
      if (files.image) fd.append('image', files.image);
      if (files.audio) fd.append('audio', files.audio);
      if (files.video) fd.append('video', files.video);

      const res  = await authFetch('/query', { method: 'POST', body: fd });
      const data = await res.json();

      setMessages(prev => [...prev, {
        id:             Date.now() + '_a',
        role:           'assistant',
        content:        data.answer || data.error || 'No response.',
        geminiSummary:  data.gemini_summary || data.answer || '',
        tone,
        images:         data.images || [],
        showCorrection: true,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + '_err', role: 'assistant',
        content: 'Could not connect to server.',
        tone: 'normal', images: [], showCorrection: false,
      }]);
    } finally {
      setTyping(false);
    }
  }

  async function saveCorrection(geminiSummary, correctAnswer) {
    try {
      await authFetch('/corrections', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ gemini_summary: geminiSummary, correct_answer: correctAnswer, input_type: 'text' }),
      });
      await loadCorrections();
    } catch(e) { alert('Failed to save correction.'); }
  }

  // Sidebar extra panel — admin tabs
  const extraPanel = (
    <div className="px-4 pt-3 pb-2 border-b border-b1">
      <div className="flex border border-b2 rounded-lg overflow-hidden">
        {TABS.map(t => (
          <button key={t} onClick={() => setSideTab(t)}
            className={`flex-1 py-1.5 text-[11px] transition-all ${
              sideTab === t ? 'bg-ag text-accent' : 'text-t2 hover:text-t1'
            }`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );

  // Group all chats by user for the Users tab
  const userGroups = allChats.reduce((acc, c) => {
    const key = c.email;
    if (!acc[key]) acc[key] = { name: c.display_name, chats: [] };
    acc[key].chats.push(c);
    return acc;
  }, {});

  const sideContent = sideTab === 'Tuning' ? chats
    : sideTab === 'Users'  ? []
    : [];

  return (
    <div className="h-full flex">
      <div className="w-64 flex-shrink-0 bg-bg2 border-r border-b1 flex flex-col h-full">
        {/* Sidebar header */}
        <div className="p-4 border-b border-b1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-serif text-base font-semibold text-white flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg,#C4934A,#8B6A35)' }}>
              V
            </div>
            <div>
              <div className="font-serif text-base font-semibold text-t1">
                Vikramaditya <span className="text-accent">AI</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 bg-ag border border-accent2 rounded text-accent uppercase tracking-wider">
                Admin
              </span>
            </div>
          </div>
          <button onClick={newChat}
            className="w-full flex items-center gap-2 px-3 py-2 bg-ag border border-accent2 rounded-lg text-accent text-sm hover:bg-accent/20 transition-all">
            + New Tuning Session
          </button>
        </div>

        {/* Admin tabs */}
        {extraPanel}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-2">

          {sideTab === 'Tuning' && (
            chats.length === 0
              ? <div className="text-center py-8 text-t3 text-xs">No sessions yet</div>
              : chats.map(c => (
                <div key={c.id} onClick={() => selectChat(c.id, c.title)}
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-colors mb-0.5 ${
                    c.id === currentChatId ? 'bg-bg4' : 'hover:bg-bg3'
                  }`}>
                  <div className="text-sm text-t1 truncate">{c.title || 'Tuning session'}</div>
                  <div className="text-[10px] text-t3 mt-0.5">{new Date(c.updated_at).toLocaleDateString()}</div>
                </div>
              ))
          )}

          {sideTab === 'Users' && (
            Object.keys(userGroups).length === 0
              ? <div className="text-center py-8 text-t3 text-xs">No user chats yet</div>
              : Object.entries(userGroups).map(([email, u]) => (
                <div key={email} className="mb-3">
                  <div className="text-xs text-accent px-2 py-1 font-medium">{u.name || email}</div>
                  {u.chats.map(c => (
                    <div key={c.id} onClick={() => selectChat(c.id, c.title)}
                      className="px-3 py-2 rounded-lg cursor-pointer hover:bg-bg3 transition-colors mb-0.5">
                      <div className="text-xs text-t1 truncate">{c.title || 'Chat'}</div>
                      <div className="text-[10px] text-t3">{new Date(c.updated_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              ))
          )}

          {sideTab === 'Fixes' && (
            corrections.length === 0
              ? <div className="text-center py-8 text-t3 text-xs">No corrections saved yet</div>
              : corrections.map(c => (
                <div key={c.id} className="mb-2 p-3 bg-bg3 border border-b2 rounded-xl">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-[10px] text-t3">{new Date(c.created_at).toLocaleDateString()}</div>
                    <button onClick={() => deactivate(c.id)}
                      className="text-[10px] px-2 py-0.5 border border-b2 rounded text-t3 hover:border-danger hover:text-danger transition-all">
                      Deactivate
                    </button>
                  </div>
                  <div className="text-xs text-t2 mb-1 leading-relaxed">
                    {(c.gemini_summary || '').substring(0, 100)}...
                  </div>
                  <div className="text-xs text-t1 leading-relaxed">
                    {(c.correct_answer || '').substring(0, 150)}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Footer */}
        <AdminFooter />
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between px-5 h-14 border-b border-b1 bg-bg2 flex-shrink-0">
          <div className="font-serif text-t2 text-base">Admin Tuning Interface</div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto px-4">
          <div className="flex-1 overflow-y-auto py-5 flex flex-col gap-5">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="font-serif text-7xl font-light italic text-b2 leading-none mb-4">𝑉</div>
                <div className="font-serif text-xl text-t2 mb-2">Tuning Interface</div>
                <div className="text-xs text-t3 max-w-sm leading-relaxed">
                  Ask questions to test the system. Press Yes if the answer is correct, No to correct it. Your corrections apply to all future queries immediately.
                </div>
              </div>
            ) : (
              messages.map(m => m.role === 'user' ? (
                <UserBubble key={m.id} content={m.content}
                  imageUrl={m.imageUrl} audioName={m.audioName} videoName={m.videoName} />
              ) : (
                <AIBubble key={m.id} content={m.content}
                  tone={m.tone} images={m.images}
                  showCorrection={m.showCorrection}
                  geminiSummary={m.geminiSummary}
                  onSaveCorrection={saveCorrection}
                />
              ))
            )}
            {typing && <TypingIndicator />}
            <div ref={msgsEndRef} />
          </div>
          <InputArea onSend={handleSend} disabled={typing} />
        </div>
      </div>
    </div>
  );
}

function AdminFooter() {
  function doLogout() {
    localStorage.clear();
    window.location.href = '/login';
  }
  return (
    <div className="p-3 border-t border-b1">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-accent2 border border-accent flex items-center justify-center text-white text-xs flex-shrink-0">
          A
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-t1 truncate">Admin</div>
          <div className="text-[10px] text-t3 truncate">{localStorage.getItem('vk_email') || 'admin'}</div>
        </div>
        <button onClick={doLogout}
          className="text-[10px] px-2 py-1 border border-b2 rounded text-t3 hover:border-danger hover:text-danger transition-all">
          Logout
        </button>
      </div>
    </div>
  );
}
