// src/pages/UserChat.jsx
import { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/api';
import Sidebar from '../components/Sidebar';
import InputArea from '../components/InputArea';
import { UserBubble, AIBubble, TypingIndicator } from '../components/MessageBubble';
import ProjectsView from './ProjectsView';
import ProjectDetail from './ProjectDetail';

// const SUGGESTIONS = [
//   'What dynasty built the Brihadeeswarar Temple?',
//   'Explain Nagara vs Dravidian architecture',
//   'Recent excavations at Mohenjo-daro',
//   'Significance of Ajanta Cave paintings',
// ];

export default function UserChat() {
  const [chats, setChats]               = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [typing, setTyping]             = useState(false);
  const [chatTitle, setChatTitle]       = useState('Heritage & Archaeology AI');
  // view: 'chat' | 'projects' | 'project-detail'
  const [view, setView]                 = useState('chat');
  const [activeProject, setActiveProject] = useState(null);
  const msgsEndRef = useRef(null);

  useEffect(() => { loadChats(); }, []);
  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  async function loadChats() {
    try {
      const res  = await authFetch('/chats');
      const data = await res.json();
      setChats(data.chats || []);
    } catch(e) { console.error(e); }
  }

  async function selectChat(chatId, title) {
    setView('chat');
    setCurrentChatId(chatId);
    setChatTitle(title || 'Conversation');
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
        id:      m.id,
        role:    m.role,
        content: m.content,
        tone:    'normal',
      })));
    } catch(e) { console.error(e); }
  }

  function newChat() {
    setView('chat');
    setCurrentChatId(null);
    setMessages([]);
    setChatTitle('Heritage & Archaeology AI');
  }

  async function ensureChatId(firstMsg) {
    if (currentChatId) return currentChatId;
    try {
      const res  = await authFetch('/chats', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: (firstMsg || 'New conversation').substring(0, 60) }),
      });
      const data = await res.json();
      setCurrentChatId(data.id);
      setChatTitle(data.title || 'New conversation');
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
        id:      Date.now() + '_a',
        role:    'assistant',
        content: data.answer || data.error || 'No response.',
        tone,
        images:  data.images || [],
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id:      Date.now() + '_err',
        role:    'assistant',
        content: 'Could not connect to server.',
        tone:    'normal',
        images:  [],
      }]);
    } finally { setTyping(false); }
  }

  function useSuggestion(text) {
    handleSend({ text, tone: 'normal', files: { image: null, audio: null, video: null }, prevUrls: {} });
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="h-full flex">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={newChat}
        onSelectChat={selectChat}
        onViewProjects={() => setView('projects')}
      />

      {/* Projects full page view */}
      {view === 'projects' && (
        <ProjectsView
          onBack={() => setView('chat')}
          onOpenProject={p => { setActiveProject(p); setView('project-detail'); }}
        />
      )}

      {/* Project detail view */}
      {view === 'project-detail' && activeProject && (
        <ProjectDetail
          project={activeProject}
          onBack={() => setView('projects')}
          onSelectChat={(chatId, title) => selectChat(chatId, title)}
        />
      )}

      {/* Normal chat view */}
      {view === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="flex items-center px-5 h-14 border-b border-b1 bg-bg2 flex-shrink-0">
            <div className="font-serif text-t2 text-base">{chatTitle}</div>
          </header>
          <div className="flex-1 flex flex-col overflow-hidden max-w-3xl w-full mx-auto px-4">
            <div className="flex-1 overflow-y-auto py-5 flex flex-col gap-5">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                  <div className="font-serif text-7xl font-light italic text-b2 leading-none mb-4">𝑉</div>
                  <div className="font-serif text-2xl text-t2 mb-2">Ask about any Heritage Site</div>
                  <div className="text-xs text-t3 max-w-xs leading-relaxed mb-6">
                    Temples · Monuments · Dynasties · Sculptures · Excavations
                  </div>
                  
                </div>
              ) : (
                messages.map(m => m.role === 'user' ? (
                  <UserBubble key={m.id} content={m.content}
                    imageUrl={m.imageUrl} audioName={m.audioName} videoName={m.videoName} />
                ) : (
                  <AIBubble key={m.id} content={m.content}
                    tone={m.tone} images={m.images} />
                ))
              )}
              {typing && <TypingIndicator />}
              <div ref={msgsEndRef} />
            </div>
            <InputArea onSend={handleSend} disabled={typing} />
          </div>
        </div>
      )}
    </div>
  );
}
