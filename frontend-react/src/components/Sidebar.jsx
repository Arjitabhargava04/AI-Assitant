// src/components/Sidebar.jsx
import { useState, useEffect } from 'react';
import WipModal from './WipModal';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/api';

export default function Sidebar({ chats, currentChatId, onNewChat, onSelectChat, onViewProjects, extraPanel, onLoginClick, mobileOpen = false, onMobileClose }) {
  const { user, logout }    = useAuth();
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(true);
  const [wipOpen, setWipOpen] = useState(false);
  const [wipFeature, setWipFeature] = useState('');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener ? mql.addEventListener('change', handler) : mql.addListener(handler);
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', handler) : mql.removeListener(handler);
    };
  }, []);

  // Close mobile drawer on selection actions
  function closeMobile() { if (isMobile && onMobileClose) onMobileClose(); }
  const withClose = (fn) => (...args) => { closeMobile(); return fn?.(...args); };

  const isGuest = !user;

  function openWip(featureName) {
    setWipFeature(featureName);
    setWipOpen(true);
  }

  // Items that require login redirect for guests
  function handleProjects() {
    if (isGuest) { onLoginClick?.(); return; }
    onViewProjects();
  }

  const filtered = search
    ? chats.filter(c => (c.title || '').toLowerCase().includes(search.toLowerCase()))
    : chats;

  // ── Collapsed icon rail (desktop only) ────────────────────
  if (!open && !isMobile) {
    return (
      <div className="flex-shrink-0 bg-bg2 border-r border-b1 flex flex-col items-center py-3 gap-1 w-14 h-full overflow-y-auto">
        {/* Expand sidebar */}
        <button onClick={() => setOpen(true)} title="Open sidebar"
          className="w-8 h-8 flex items-center justify-center rounded-md text-t3 hover:text-t1 hover:bg-bg3 transition-all mb-2 flex-shrink-0">
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

        {/* Home */}
        <IconBtn onClick={onNewChat} title="Home">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2h-4a2 2 0 01-2-2v-5h-2v5a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          </svg>
        </IconBtn>

        {/* Search Archives — WIP */}
        <IconBtn onClick={() => openWip('Search Archives')} title="Search Archives">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </IconBtn>

        {/* Maps & Sites — WIP */}
        <IconBtn onClick={() => openWip('Maps and Sites')} title="Maps & Sites">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s-8-7.58-8-13a8 8 0 0116 0c0 5.42-8 13-8 13z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
        </IconBtn>

        {/* Timeline — WIP */}
        <IconBtn onClick={() => openWip('Timeline')} title="Timeline">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
          </svg>
        </IconBtn>

        {/* Divider */}
        <div className="w-6 h-px bg-b1 my-1 flex-shrink-0" />

        {/* Collections — WIP */}
        <IconBtn onClick={() => openWip('Collections')} title="Collections">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </IconBtn>

        {/* Reports — WIP */}
        <IconBtn onClick={() => openWip('Reports')} title="Reports">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
        </IconBtn>

        {/* Projects */}
        <IconBtn onClick={handleProjects} title="Projects">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </IconBtn>

        {/* Spacer */}
        <div className="flex-1 min-h-2" />

        {/* Settings — WIP */}
        <IconBtn onClick={() => openWip('Settings')} title="Settings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </IconBtn>

        {/* Bottom — Login (guest) or User avatar (logged-in) */}
        {isGuest ? (
          <button
            onClick={onLoginClick}
            title="Login"
            className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#C4934A,#8B6A35)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
          </button>
        ) : (
          <div
            className="w-8 h-8 rounded-full bg-bg3 border border-b2 flex items-center justify-center text-xs cursor-pointer flex-shrink-0"
            title={user?.email}
          >
            👤
          </div>
        )}

        {/* WIP Modal — needed in collapsed view too */}
        <WipModal
          isOpen={wipOpen}
          featureName={wipFeature}
          onClose={() => setWipOpen(false)}
        />
      </div>
    );
  }

  // ── Full sidebar (also used as mobile drawer) ─────────────
  const sidebarClass = isMobile
    ? `fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[85vw] bg-bg2 border-r border-b1 flex flex-col transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
    : 'w-64 flex-shrink-0 bg-bg2 border-r border-b1 flex flex-col h-full';

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div onClick={onMobileClose} className="fixed inset-0 bg-black/60 z-40" aria-hidden="true" />
      )}
    <div className={sidebarClass}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-b1">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Vikramaditya AI"
            className="w-8 h-8 flex-shrink-0"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(196,147,74,0.25))' }}
          />
          <span className="font-serif text-sm font-semibold text-t1">
            Vikramaditya <span className="text-accent">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Collapse / close sidebar */}
          <button onClick={() => isMobile ? onMobileClose?.() : setOpen(false)} title={isMobile ? 'Close' : 'Close sidebar'}
            className="w-7 h-7 flex items-center justify-center rounded-md text-t3 hover:text-t1 hover:bg-bg3 transition-all">
            {isMobile ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {extraPanel}

      {/* Nav items — Group 1 */}
      <div className="px-2 py-2 border-b border-b1 space-y-0.5">
        <NavItem onClick={withClose(onNewChat)} label="New chat" icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        }/>
        <NavItem onClick={withClose(onNewChat)} label="Home" icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2h-4a2 2 0 01-2-2v-5h-2v5a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          </svg>
        }/>
        <NavItem onClick={() => openWip('Search Archives')} label="Search Archives" icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        }/>
        <NavItem onClick={() => openWip('Maps and Sites')} label="Maps & Sites" icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 22s-8-7.58-8-13a8 8 0 0116 0c0 5.42-8 13-8 13z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
        }/>
        <NavItem onClick={() => openWip('Timeline')} label="Timeline"  icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
          </svg>
        }/>
      </div>

      {/* Nav items — Group 2 */}
      <div className="px-2 py-2 border-b border-b1 space-y-0.5">
        <NavItem onClick={() => openWip('Collections')} label="Collections" icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        }/>
        <NavItem onClick={() => openWip('Reports')} label="Reports"  icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
        }/>
        <NavItem onClick={withClose(handleProjects)} label="Projects" icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        }/>
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
          <div key={c.id} onClick={() => { closeMobile(); onSelectChat(c.id, c.title); }}
            className={`px-3 py-2 rounded-lg cursor-pointer transition-colors mb-0.5 ${
              c.id === currentChatId ? 'bg-bg4 text-t1' : 'text-t2 hover:bg-bg3 hover:text-t1'
            }`}>
            <div className="text-sm truncate">{c.title || 'New conversation'}</div>
            <div className="text-[10px] text-t3 mt-0.5">{formatDate(c.updated_at)}</div>
          </div>
        ))}
      </div>

      {/* Settings (above footer) */}
      <div className="px-2 py-2 border-t border-b1">
        <NavItem onClick={() => openWip('Settings')} label="Settings"  icon={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        }/>
      </div>

      {/* Footer — different for guest vs logged-in */}
      <div className="p-3 border-t border-b1">
        {isGuest ? (
          // ─── GUEST: Login button + signup link ───
          <>
            <button onClick={onLoginClick}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#C4934A,#8B6A35)', color: '#1A1208' }}>
              Login
            </button>
            <button onClick={onLoginClick}
              className="block w-full text-center mt-2 text-[11px] text-t3 hover:text-accent transition-colors">
              New here? <span className="text-accent">Sign up free</span>
            </button>
          </>
        ) : (
          // ─── LOGGED-IN: User profile + logout ───
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
        )}
      </div>

      {/* WIP Modal */}
      <WipModal
        isOpen={wipOpen}
        featureName={wipFeature}
        onClose={() => setWipOpen(false)}
      />
    </div>
    </>
  );
}

// Reusable nav item with optional "Soon" tag
function NavItem({ onClick, label, icon, soon }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-t2 text-sm hover:bg-bg3 hover:text-t1 transition-all">
      <span className="flex-shrink-0 text-t3 flex items-center justify-center w-4 h-4">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {soon && (
        <span className="text-[8px] px-1.5 py-0.5 rounded text-accent font-semibold uppercase tracking-wider"
              style={{ background: 'rgba(196,147,74,0.12)' }}>
          Soon
        </span>
      )}
    </button>
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