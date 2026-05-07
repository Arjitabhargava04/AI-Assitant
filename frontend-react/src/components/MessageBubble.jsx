import { useState, useRef } from 'react';
import { authFetch, renderMarkdown } from '../utils/api';

let globalAudio  = null;
const audioCache = new Map();

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  );
}
function LikeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
    </svg>
  );
}
function DislikeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
    </svg>
  );
}
function RegenerateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
    </svg>
  );
}
function SpeakIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function ActionBtn({ onClick, active, activeColor, title, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{
        width: 28, height: 28, borderRadius: 7,
        border: `0.5px solid ${active ? activeColor + '44' : '#2a2a2a'}`,
        background: active ? activeColor + '11' : 'none',
        color: active ? activeColor : '#555',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#888'; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#555'; }}}>
      {children}
    </button>
  );
}

export function UserBubble({ content, imageUrl, audioName, videoName, messageId, isLast, onEditSave }) {
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(content);
  const [copied, setCopied]     = useState(false);

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
    <div className="flex gap-2 flex-row-reverse group">
      <div className="w-7 h-7 rounded-full bg-bg3 border border-b2 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
        👤
      </div>
      <div className="max-w-[calc(100%-36px)]">
        <div className="text-[10px] text-t3 mb-1 text-right">You</div>

        {editing ? (
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 12, minWidth: 200 }}>
            <textarea value={editText} onChange={e => setEditText(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#E8E2D9', fontSize: 13, resize: 'none', minHeight: 60, lineHeight: 1.6 }} />
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
          <div className="px-4 py-3 bg-ubg border border-b2 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
            {imageUrl && (
              <div className="mb-2">
                <img src={imageUrl} alt="upload" className="max-w-[240px] max-h-[180px] rounded-xl object-cover border border-b2 block" />
              </div>
            )}
            {audioName && <div className="text-t2 text-xs mb-1">🎙️ {audioName}</div>}
            {videoName && <div className="text-t2 text-xs mb-1">📹 {videoName}</div>}
            {content && <p className="text-t1">{content}</p>}
          </div>
        )}

        {/* User message action buttons */}
        {!editing && (
          <div className="msg-actions" style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end', opacity: 0, transition: 'opacity 0.15s' }}>
            <ActionBtn onClick={copyText} active={copied} activeColor="#4a9a6a" title="Copy">
              <CopyIcon />
            </ActionBtn>
            {isLast && (
              <ActionBtn onClick={() => setEditing(true)} title="Edit">
                <EditIcon />
              </ActionBtn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AIBubble({ content, tone, images, messageId, isLast, onRegenerate }) {
  const [liked, setLiked]         = useState(false);
  const [disliked, setDisliked]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [speakState, setSpeakState] = useState('idle');
  const audioRef = useRef(null);

  function copyText() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLike() {
    setLiked(l => !l);
    setDisliked(false);
  }

  function handleDislike() {
    setDisliked(d => !d);
    setLiked(false);
  }

   async function handleSpeak() {
    if (speakState === 'playing') {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (globalAudio)      { globalAudio.pause(); globalAudio = null; }
      setSpeakState('idle');
      return;
    }
    if (speakState === 'loading') return;
    if (globalAudio) { globalAudio.pause(); globalAudio = null; }

    const cacheKey = content.substring(0, 200);

    if (audioCache.has(cacheKey)) {
      const cachedB64 = audioCache.get(cacheKey);
      const audio = new Audio('data:audio/wav;base64,' + cachedB64);
      audioRef.current = audio;
      globalAudio = audio;
      setSpeakState('playing');
      audio.play();
      audio.onended = () => { setSpeakState('idle'); globalAudio = null; audioRef.current = null; };
      return;
    }

    setSpeakState('loading');
    try {
      const res  = await authFetch('/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, voice: 'Aoede' }),
      });
      const data = await res.json();
      if (data.audio_b64) {
        audioCache.set(cacheKey, data.audio_b64);
        const audio = new Audio('data:audio/wav;base64,' + data.audio_b64);
        audioRef.current = audio;
        globalAudio = audio;
        setSpeakState('playing');
        audio.play();
        audio.onended = () => { setSpeakState('idle'); globalAudio = null; audioRef.current = null; };
      } else throw new Error('No audio');
    } catch {
      setSpeakState('idle');
    }
  }

  return (
    <div className="flex gap-2 group">
      <div className="w-7 h-7 rounded-full flex items-center justify-center font-serif font-semibold text-white text-sm flex-shrink-0 mt-0.5"
           style={{ background: 'linear-gradient(135deg,#C4934A,#8B6A35)' }}>
        V
      </div>
      <div className="max-w-[calc(100%-36px)]">
        <div className="text-[10px] text-t3 mb-1 flex items-center gap-1.5">
          Vikramaditya AI
          {tone && tone !== 'normal' && (
            <span className="text-[9px] px-1.5 py-0.5 bg-ag border border-accent2 rounded text-accent uppercase tracking-wider">
              {tone}
            </span>
          )}
        </div>
        <div className="px-4 py-3 bg-abg border border-b1 rounded-2xl rounded-tl-sm text-sm leading-relaxed">
          <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          {images && images.length > 0 && (
            <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))' }}>
              {images.map((url, i) => (
                <img key={i} src={url} alt="heritage" loading="lazy"
                  className="w-full h-28 object-cover rounded-lg border border-b2"
                  onError={e => e.target.style.display = 'none'} />
              ))}
            </div>
          )}
        </div>

        {/* AI message action buttons */}
        <div className="msg-actions" style={{ display: 'flex', gap: 4, marginTop: 6, opacity: 0, transition: 'opacity 0.15s' }}>
          <ActionBtn onClick={copyText} active={copied} activeColor="#4a9a6a" title="Copy">
            <CopyIcon />
          </ActionBtn>
          <ActionBtn onClick={handleLike} active={liked} activeColor="#4a9a6a" title="Like">
            <LikeIcon />
          </ActionBtn>
          <ActionBtn onClick={handleDislike} active={disliked} activeColor="#ff4a4a" title="Dislike">
            <DislikeIcon />
          </ActionBtn>
          {speakState === 'loading' ? (
            <div style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #C4934A44', background: '#C4934A11', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <div className="dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#C4934A' }} />
              <div className="dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#C4934A', animationDelay: '0.2s' }} />
              <div className="dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#C4934A', animationDelay: '0.4s' }} />
            </div>
          ) : (
            <ActionBtn
              onClick={handleSpeak}
              active={speakState === 'playing'}
              activeColor="#C4934A"
              title={speakState === 'playing' ? 'Stop' : 'Read aloud'}>
              <SpeakIcon />
            </ActionBtn>
          )}
          {isLast && (
            <ActionBtn onClick={onRegenerate} title="Regenerate">
              <RegenerateIcon />
            </ActionBtn>
          )}
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center font-serif font-semibold text-white text-sm flex-shrink-0"
           style={{ background: 'linear-gradient(135deg,#C4934A,#8B6A35)' }}>
        V
      </div>
      <div className="px-4 py-3 bg-abg border border-b1 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-accent dot" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent dot" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent dot" />
      </div>
    </div>
  );
}