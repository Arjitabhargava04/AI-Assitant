// src/pages/ProjectsView.jsx
import { useState, useEffect } from 'react';
import { authFetch, formatDate } from '../utils/api';

export default function ProjectsView({ onBack, onOpenProject }) {
  const [projects, setProjects]   = useState([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [newName, setNewName]     = useState('');
  const [creating, setCreating]   = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    try {
      const res  = await authFetch('/chats/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function createProject() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res  = await authFetch('/chats/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      setProjects(prev => [data, ...prev]);
      setNewName('');
      setShowNew(false);
    } catch(e) { console.error(e); }
    finally { setCreating(false); }
  }

  async function deleteProject(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this project? Chats inside will not be deleted.')) return;
    try {
      await authFetch(`/chats/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch(e) { console.error(e); }
  }

  const filtered = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg">

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-4 sm:py-6 border-b border-b1 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button onClick={onBack}
            className="text-t3 hover:text-t1 transition-colors text-sm flex items-center gap-1.5 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
          <h1 className="font-serif text-xl sm:text-2xl md:text-3xl font-light text-t1 truncate">Projects</h1>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-bg3 border border-b2 rounded-xl text-t1 text-sm hover:border-accent hover:text-accent transition-all flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span className="hidden sm:inline">New project</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* New project modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
             onClick={() => setShowNew(false)}>
          <div className="bg-bg2 border border-b2 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
               onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-xl text-t1 mb-4">New Project</h2>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Project name..."
              autoFocus
              className="w-full px-4 py-3 bg-bg3 border border-b2 rounded-xl text-t1 text-sm outline-none focus:border-accent placeholder:text-t3 mb-4"
              onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setShowNew(false); }}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-t2 hover:text-t1 transition-colors">
                Cancel
              </button>
              <button onClick={createProject} disabled={!newName.trim() || creating}
                className="px-4 py-2 text-sm bg-accent hover:bg-accent2 rounded-lg text-white disabled:opacity-50 transition-colors">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 sm:px-6 md:px-8 py-4 flex-shrink-0">
        <div className="relative max-w-xl">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-t3" width="15" height="15"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-11 pr-4 py-3 bg-bg3 border border-b2 rounded-xl text-t1 text-sm outline-none focus:border-accent placeholder:text-t3 transition-colors"
          />
        </div>
      </div>

      {/* Projects grid */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-2">
        {loading ? (
          <div className="text-center py-20 text-t3 text-sm">Loading...</div>
        ) : !filtered.length ? (
          <div className="text-center py-20">
            <div className="font-serif text-5xl text-b2 mb-4">📁</div>
            <div className="text-t2 text-sm mb-2">
              {search ? 'No projects match your search' : 'No projects yet'}
            </div>
            {!search && (
              <button onClick={() => setShowNew(true)}
                className="text-accent text-sm hover:underline">
                Create your first project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-4xl">
            {filtered.map(p => (
              <div key={p.id} onClick={() => onOpenProject(p)}
                className="group relative p-6 bg-bg2 border border-b1 rounded-2xl cursor-pointer hover:border-b2 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.5" className="text-accent">
                    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  </svg>
                  <button onClick={e => deleteProject(e, p.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-t3 hover:text-danger hover:bg-bg3 transition-all text-xs">
                    ✕
                  </button>
                </div>
                <div className="font-medium text-t1 text-base mb-1">{p.name}</div>
                <div className="text-xs text-t3">
                  {p.created_at ? `Created ${formatDate(p.created_at)}` : 'No activity yet'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
