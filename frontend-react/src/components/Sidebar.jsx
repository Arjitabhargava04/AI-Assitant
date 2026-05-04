// src/components/Sidebar.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/api';

export default function Sidebar({ chats, currentChatId, onNewChat, onSelectChat, onViewProjects, extraPanel }) {
  const { user, logout }    = useAuth();
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(true);

  const filtered = search
    ? chats.filter(c => (c.title || '').toLowerCase().includes(search.toLowerCase()))
    : chats;

  // ── Collapsed icon rail ───────────────────────────────────
  if (!open) {
    return (
      <div className="flex-shrink-0 bg-bg2 border-r border-b1 flex flex-col items-center py-3 gap-1 w-14 h-full">
        {/* Expand sidebar */}
        <button onClick={() => setOpen(true)} title="Open sidebar"
          className="w-8 h-8 flex items-center justify-center rounded-md text-t3 hover:text-t1 hover:bg-bg3 transition-all mb-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>

        {/* New chat */}
        <IconBtn onClick={onNewChat} title="New chat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </IconBtn>

        {/* Search */}
        <IconBtn title="Search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </IconBtn>

        {/* Chats */}
        <IconBtn title="Chats">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </IconBtn>

        {/* Projects */}
        <IconBtn onClick={onViewProjects} title="Projects">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </IconBtn>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-bg3 border border-b2 flex items-center justify-center text-xs cursor-pointer"
             title={user?.email}>
          👤
        </div>
      </div>
    );
  }

  // ── Full sidebar ──────────────────────────────────────────
  return (
    <div className="w-64 flex-shrink-0 bg-bg2 border-r border-b1 flex flex-col h-full">

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-b1">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-serif text-sm font-semibold text-white flex-shrink-0"
               style={{ background: 'linear-gradient(135deg,#C4934A,#8B6A35)' }}>
            V
          </div>
          <span className="font-serif text-sm font-semibold text-t1">
            Vikramaditya <span className="text-accent">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Collapse sidebar */}
          <button onClick={() => setOpen(false)} title="Close sidebar"
            className="w-7 h-7 flex items-center justify-center rounded-md text-t3 hover:text-t1 hover:bg-bg3 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
        </div>
      </div>

      {extraPanel}

      {/* Nav items */}
      <div className="px-2 py-2 border-b border-b1 space-y-0.5">
        <button onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-t2 text-sm hover:bg-bg3 hover:text-t1 transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New chat
        </button>
        <button onClick={onViewProjects}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-t2 text-sm hover:bg-bg3 hover:text-t1 transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
          Projects
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-b1">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-3 py-1.5 bg-bg3 border border-b2 rounded-lg text-t1 text-xs outline-none placeholder:text-t3 focus:border-accent transition-colors"
        />
      </div>

      {/* Recents label */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] text-t3 uppercase tracking-wider font-medium">Recents</span>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!filtered.length ? (
          <div className="text-center py-8 text-t3 text-xs">No conversations yet</div>
        ) : filtered.map(c => (
          <div key={c.id} onClick={() => onSelectChat(c.id, c.title)}
            className={`px-3 py-2 rounded-lg cursor-pointer transition-colors mb-0.5 ${
              c.id === currentChatId ? 'bg-bg4 text-t1' : 'text-t2 hover:bg-bg3 hover:text-t1'
            }`}>
            <div className="text-sm truncate">{c.title || 'New conversation'}</div>
            <div className="text-[10px] text-t3 mt-0.5">{formatDate(c.updated_at)}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-b1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-bg3 border border-b2 flex items-center justify-center text-xs flex-shrink-0">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-t1 truncate">{user?.name || user?.email}</div>
            <div className="text-[10px] text-t3 truncate">{user?.email}</div>
          </div>
          <button onClick={logout}
            className="text-[10px] px-2 py-1 border border-b2 rounded text-t3 hover:border-danger hover:text-danger transition-all">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 flex items-center justify-center rounded-md text-t3 hover:text-t1 hover:bg-bg3 transition-all">
      {children}
    </button>
  );
}