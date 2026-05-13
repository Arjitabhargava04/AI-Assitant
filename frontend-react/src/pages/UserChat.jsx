// src/pages/UserChat.jsx
import { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/api';
import Sidebar from '../components/Sidebar';
import InputArea from '../components/InputArea';
import { UserBubble, AIBubble, TypingIndicator, ThinkingIndicator } from '../components/MessageBubble';import ProjectsView from './ProjectsView';
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
  const [activeProject, setActiveProject]           = useState(null);
  const [activeProjectForChat, setActiveProjectForChat] = useState(null);
  const activeProjectForChatRef = useRef(null);
  const [projectRefreshKey, setProjectRefreshKey]       = useState(0);
  const msgsEndRef = useRef(null);
  const [lastSentTone, setLastSentTone]         = useState('normal');
  const [lastSentHasImage, setLastSentHasImage] = useState(false);
  const [lastSentHasAudio, setLastSentHasAudio] = useState(false);
  const [lastSentHasVideo, setLastSentHasVideo] = useState(false);
  const [streamingMsgId, setStreamingMsgId]     = useState(null);
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
    setActiveProjectForChat(null);
    activeProjectForChatRef.current = null;      // ← clear ref too
  }

  function newChatInProject(project) {
    setView('chat');
    setCurrentChatId(null);
    setMessages([]);
    setChatTitle(project.name);
    setActiveProjectForChat(project);
    activeProjectForChatRef.current = project;   // ← ref always has latest value
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

      // If chat was started inside a project — assign it automatically
      const projectToAssign = activeProjectForChatRef.current;
      if (projectToAssign) {
        await authFetch(`/chats/${data.id}/project`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ project_id: projectToAssign.id }),
        });
        setActiveProjectForChat(null);
        activeProjectForChatRef.current = null;
        setProjectRefreshKey(k => k + 1);
      }

      await loadChats();
      return data.id;
    } catch(e) { console.error(e); return ''; }
  }

  async function handleSend({ text, tone, files, prevUrls }) {
    if (typing) return;

    setLastSentTone(tone);
    setLastSentHasImage(!!files?.image);
    setLastSentHasAudio(!!files?.audio);
    setLastSentHasVideo(!!files?.video);

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
      const aiMsgId = Date.now() + '_a';
      let firstChunkReceived = false;

      const res = await authFetch('/query/stream', { method: 'POST', body: fd });

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer       = '';
      let fullText     = '';         // complete text received from backend
      let revealedText = '';         // text currently shown in UI
      let images       = [];
      let streamDone   = false;

      // Smooth reveal — show characters at fixed rate regardless of chunk size
      const REVEAL_SPEED = 15;       // milliseconds per character (lower = faster)
      const CHARS_PER_TICK = 2;      // characters revealed per tick

      const revealInterval = setInterval(() => {
        if (revealedText.length < fullText.length) {
          const nextLen = Math.min(revealedText.length + CHARS_PER_TICK, fullText.length);
          revealedText = fullText.substring(0, nextLen);

          if (!firstChunkReceived) {
            firstChunkReceived = true;
            setTyping(false);
            setStreamingMsgId(aiMsgId);
            setMessages(prev => [...prev, {
              id:      aiMsgId,
              role:    'assistant',
              content: revealedText,
              tone,
              images:  [],
            }]);
          } else {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? { ...m, content: revealedText } : m
            ));
          }
        } else if (streamDone) {
          // Stream is done AND all text revealed → stop interval
          clearInterval(revealInterval);
        }
      }, REVEAL_SPEED);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamDone = true;
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);

              if (obj.type === 'text') {
                fullText += obj.data;
              }

              if (obj.type === 'images') {
                images = obj.data;
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, images } : m
                ));
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      } finally {
        // Wait for reveal to catch up to end of stream
        const waitForReveal = () => new Promise(resolve => {
          const check = setInterval(() => {
            if (revealedText.length >= fullText.length) {
              clearInterval(check);
              clearInterval(revealInterval);
              resolve();
            }
          }, 50);
        });
        await waitForReveal();
        setStreamingMsgId(null);
      }
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
  async function handleRegenerate() {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const lastAiMsg   = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastUserMsg || typing) return;

    const oldAiId = lastAiMsg?.id;
    const useTone = lastUserMsg.tone || 'normal';
    setMessages(prev => prev.filter(m => m.id !== oldAiId));

    setLastSentTone(useTone);
    setLastSentHasImage(false);
    setLastSentHasAudio(false);
    setLastSentHasVideo(false);
    setTyping(true);

    try {
      const fd = new FormData();
      fd.append('text', lastUserMsg.content);
      fd.append('tone', useTone);
      fd.append('chat_id', '');

      const newAiId = Date.now() + '_a';
      let firstChunkReceived = false;

      const res = await authFetch('/query/stream', { method: 'POST', body: fd });

      const reader   = res.body.getReader();
      const decoder  = new TextDecoder();
      let buffer     = '';
      let fullText   = '';
      let revealedText = '';
      let streamDone = false;

      const REVEAL_SPEED = 15;
      const CHARS_PER_TICK = 2;

      const revealInterval = setInterval(() => {
        if (revealedText.length < fullText.length) {
          const nextLen = Math.min(revealedText.length + CHARS_PER_TICK, fullText.length);
          revealedText = fullText.substring(0, nextLen);

          if (!firstChunkReceived) {
            firstChunkReceived = true;
            setTyping(false);
            setStreamingMsgId(newAiId);
            setMessages(prev => [...prev, {
              id: newAiId, role: 'assistant',
              content: revealedText,
              tone: useTone, images: [],
            }]);
          } else {
            setMessages(prev => prev.map(m =>
              m.id === newAiId ? { ...m, content: revealedText } : m
            ));
          }
        } else if (streamDone) {
          clearInterval(revealInterval);
        }
      }, REVEAL_SPEED);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { streamDone = true; break; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === 'text') fullText += obj.data;
            } catch (e) { console.error('Parse error:', e); }
          }
        }
      } finally {
        const waitForReveal = () => new Promise(resolve => {
          const check = setInterval(() => {
            if (revealedText.length >= fullText.length) {
              clearInterval(check);
              clearInterval(revealInterval);
              resolve();
            }
          }, 50);
        });
        await waitForReveal();
        setStreamingMsgId(null);

        if (oldAiId && currentChatId && fullText) {
          await authFetch(`/messages/${oldAiId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: fullText }),
          });
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + '_err', role: 'assistant',
        content: 'Could not regenerate.', tone: 'normal', images: [],
      }]);
    } finally { setTyping(false); }
  }

  async function handleEditSave(messageId, newText) {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, content: newText } : m
    ));
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    const oldAiId   = lastAiMsg?.id;
    if (oldAiId) {
      setMessages(prev => prev.filter(m => m.id !== oldAiId));
    }

    setLastSentTone('normal');
    setLastSentHasImage(false);
    setLastSentHasAudio(false);
    setLastSentHasVideo(false);
    setTyping(true);

    try {
      const fd = new FormData();
      fd.append('text', newText);
      fd.append('tone', 'normal');
      fd.append('chat_id', '');

      const newAiId = Date.now() + '_a';
      let firstChunkReceived = false;

      const res = await authFetch('/query/stream', { method: 'POST', body: fd });

      const reader   = res.body.getReader();
      const decoder  = new TextDecoder();
      let buffer     = '';
      let fullText   = '';
      let revealedText = '';
      let streamDone = false;

      const REVEAL_SPEED = 15;
      const CHARS_PER_TICK = 2;

      const revealInterval = setInterval(() => {
        if (revealedText.length < fullText.length) {
          const nextLen = Math.min(revealedText.length + CHARS_PER_TICK, fullText.length);
          revealedText = fullText.substring(0, nextLen);

          if (!firstChunkReceived) {
            firstChunkReceived = true;
            setTyping(false);
            setStreamingMsgId(newAiId);
            setMessages(prev => [...prev, {
              id: newAiId, role: 'assistant',
              content: revealedText,
              tone: 'normal', images: [],
            }]);
          } else {
            setMessages(prev => prev.map(m =>
              m.id === newAiId ? { ...m, content: revealedText } : m
            ));
          }
        } else if (streamDone) {
          clearInterval(revealInterval);
        }
      }, REVEAL_SPEED);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { streamDone = true; break; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === 'text') fullText += obj.data;
            } catch (e) { console.error('Parse error:', e); }
          }
        }
      } finally {
        const waitForReveal = () => new Promise(resolve => {
          const check = setInterval(() => {
            if (revealedText.length >= fullText.length) {
              clearInterval(check);
              clearInterval(revealInterval);
              resolve();
            }
          }, 50);
        });
        await waitForReveal();
        setStreamingMsgId(null);

        if (oldAiId && currentChatId && fullText) {
          await authFetch(`/messages/${oldAiId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: fullText }),
          });
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + '_err', role: 'assistant',
        content: 'Could not regenerate.', tone: 'normal', images: [],
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
          onNewChatInProject={newChatInProject}
          refreshKey={projectRefreshKey}
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
                  <div className="font-serif text-2xl text-t2 mb-2">Discover Heritage, Archaeology, and Culture</div>
                  <div className="text-xs text-t3 max-w-xs leading-relaxed mb-6">
                    Temples · Monuments · Dynasties · Sculptures · Culture · Excavations
                  </div>
                  
                </div>
              ) : (
                messages.map((m, index) => {
                const lastUserIndex = messages.map(x => x.role).lastIndexOf('user');
                const lastAiIndex   = messages.map(x => x.role).lastIndexOf('assistant');
                const isLast = m.role === 'user'
                  ? index === lastUserIndex
                  : index === lastAiIndex;
                return m.role === 'user' ? (
                  <UserBubble key={m.id} content={m.content}
                    imageUrl={m.imageUrl} audioName={m.audioName} videoName={m.videoName}
                    messageId={m.id}
                    isLast={isLast}
                    onEditSave={(newText) => handleEditSave(m.id, newText)}
                  />
                ) : (
                  <AIBubble key={m.id} content={m.content}
                    tone={m.tone} images={m.images}
                    messageId={m.id}
                    isLast={isLast}
                    onRegenerate={handleRegenerate}
                    isStreaming={m.id === streamingMsgId}
                  />
                );
              })
              )}
              {typing && (
                <ThinkingIndicator
                  tone={lastSentTone || 'normal'}
                  hasImage={lastSentHasImage}
                  hasAudio={lastSentHasAudio}
                  hasVideo={lastSentHasVideo}
                />
              )}
              <div ref={msgsEndRef} />
            </div>
            <InputArea onSend={handleSend} disabled={typing} />
          </div>
        </div>
      )}
    </div>
  );
}
