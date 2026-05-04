// src/pages/ProjectDetail.jsx
import { useState, useEffect } from 'react';
import { authFetch, formatDate } from '../utils/api';

export default function ProjectDetail({ project, onBack, onSelectChat }) {
  const [chats, setChats]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadChats(); }, [project.id]);

  async function loadChats() {
    setLoading(true);
    try {
      const res  = await authFetch(`/chats/projects/${project.id}/chats`);
      const data = await res.json();
      setChats(data.chats || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg">

      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-b1 flex-shrink-0">
        <button onClick={onBack}
          className="text-t3 hover:text-t1 transition-colors flex items-center gap-1.5 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Projects
        </button>
        <div className="w-px h-4 bg-b2" />
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.5" className="text-accent">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
          <h1 className="font-serif text-2xl font-light text-t1">{project.name}</h1>
        </div>
      </div>

      {/* Chats list */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="text-center py-20 text-t3 text-sm">Loading...</div>
        ) : !chats.length ? (
          <div className="text-center py-20">
            <div className="font-serif text-5xl text-b2 mb-4">💬</div>
            <div className="text-t2 text-sm">No conversations in this project yet</div>
            <div className="text-t3 text-xs mt-2">
              Start a conversation and assign it to this project
            </div>
          </div>
        ) : (
          <div className="max-w-2xl space-y-2">
            <div className="text-xs text-t3 uppercase tracking-wider mb-4">
              {chats.length} conversation{chats.length !== 1 ? 's' : ''}
            </div>
            {chats.map(c => (
              <div key={c.id} onClick={() => onSelectChat(c.id, c.title)}
                className="flex items-center gap-4 p-4 bg-bg2 border border-b1 rounded-xl cursor-pointer hover:border-b2 transition-all group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.5" className="text-t3 flex-shrink-0">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-t1 truncate group-hover:text-accent transition-colors">
                    {c.title || 'New conversation'}
                  </div>
                  <div className="text-[10px] text-t3 mt-0.5">{formatDate(c.updated_at)}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.5" className="text-t3 opacity-0 group-hover:opacity-100 transition-all">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
