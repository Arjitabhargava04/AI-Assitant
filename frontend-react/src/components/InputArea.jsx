// src/components/InputArea.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const TONES = [
  { id: 'normal',      label: 'Normal',      icon: '✍️' },
  { id: 'researcher',  label: 'Researcher',  icon: '🔬' },
  { id: 'concise',     label: 'Concise',     icon: '⚡' },
  { id: 'explanatory', label: 'Explanatory', icon: '📖' },
  { id: 'formal',      label: 'Formal',      icon: '🎓' },
];

export default function InputArea({ onSend, disabled, isGuest = false }) {
  const navigate = useNavigate();

  // For guests — any restricted action → go to login page
  function guestBlock(e) {
    if (!isGuest) return false;
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setPlusOpen(false);
    navigate('/login');
    return true;
  }
  const [text, setText]         = useState('');
  const [tone, setTone]         = useState('normal');
  const [files, setFiles]       = useState({ image: null, audio: null, video: null });
  const [prevUrls, setPrevUrls] = useState({});
  const [plusOpen, setPlusOpen] = useState(false);
  const [recState, setRecState] = useState(null);
  const textareaRef     = useRef(null);
  const mediaRecRef     = useRef(null);
  const streamRef       = useRef(null);
  const timerRef        = useRef(null);
  const videoPreviewRef = useRef(null);

  useEffect(() => {
    function handler() { setPlusOpen(false); }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  function grow() {
    const el = textareaRef.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function detectFileType(file) {
    const mime = file.type.toLowerCase();
    const ext  = file.name.split('.').pop().toLowerCase();
    const imageExts = ['jpg','jpeg','png','gif','webp','bmp','svg'];
    const audioExts = ['mp3','wav','ogg','m4a','aac','webm','flac'];
    const videoExts = ['mp4','webm','mov','avi','mkv','flv','wmv'];
    if (mime.startsWith('image') || imageExts.includes(ext)) return 'image';
    if (mime.startsWith('audio') || audioExts.includes(ext)) return 'audio';
    if (mime.startsWith('video') || videoExts.includes(ext)) return 'video';
    return null;
  }

  function attachFile(e, type) {
    const f = e.target.files[0]; if (!f) return;
    const url = type === 'image' ? URL.createObjectURL(f) : null;
    if (prevUrls[type]) URL.revokeObjectURL(prevUrls[type]);
    setFiles(prev => ({ ...prev, [type]: f }));
    setPrevUrls(prev => ({ ...prev, [type]: url }));
    setPlusOpen(false);
  }
  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function attachFileSmart(e) {
    if (guestBlock(e)) return;  // Guest → login
    const f = e.target.files[0];
    if (!f) return;

    const type = detectFileType(f);
    if (!type) return;

    const limits = { image: 20, audio: 100, video: 500 };
    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > limits[type]) return;

    if (type === 'image') {
      const base64 = await toBase64(f);
      if (prevUrls.image) URL.revokeObjectURL(prevUrls.image);
      setFiles(prev => ({ ...prev, image: f }));
      setPrevUrls(prev => ({ ...prev, image: base64 }));
    } else {
      setFiles(prev => ({ ...prev, [type]: f }));
      setPrevUrls(prev => ({ ...prev, [type]: null }));
    }
    setPlusOpen(false);
  }

  function removeFile(type) {
    if (prevUrls[type]) URL.revokeObjectURL(prevUrls[type]);
    setFiles(prev => ({ ...prev, [type]: null }));
    setPrevUrls(prev => ({ ...prev, [type]: null }));
  }

  async function startRecord(type) {
    if (guestBlock()) return;  // Guest → login
    setPlusOpen(false);
    try {
      const constraints = type === 'audio' ? { audio: true } : { video: true, audio: true };
      const stream      = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Show live camera preview for video
      if (type === 'video') {
        setTimeout(() => {
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
          }
        }, 100);
      }

      const chunks = [];
      const rec    = new MediaRecorder(stream);
      mediaRecRef.current = rec;
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: type === 'audio' ? 'audio/webm' : 'video/webm' });
        const file = new File([blob], `${type}-recording.webm`, { type: blob.type });
        setFiles(prev => ({ ...prev, [type]: file }));
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
        setRecState(null);
      };
      rec.start(100);
      let secs = 0;
      timerRef.current = setInterval(() => { secs++; setRecState(s => ({ ...s, secs })); }, 1000);
      setRecState({ type, secs: 0 });
    } catch {
      alert(`${type === 'audio' ? 'Microphone' : 'Camera'} access denied.`);
    }
  }

  function stopRecord() {
    if (mediaRecRef.current?.state !== 'inactive') mediaRecRef.current?.stop();
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
  }

  function cancelRecord() {
    if (mediaRecRef.current?.state !== 'inactive') {
      mediaRecRef.current.ondataavailable = null;
      mediaRecRef.current.onstop = null;
      mediaRecRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(timerRef.current);
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    setRecState(null);
  }

  function formatSecs(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  async function send() {
    if (disabled) return;
    const t = text.trim();
    if (!t && !files.image && !files.audio && !files.video) return;
    onSend({ text: t, tone, files: { ...files }, prevUrls: { ...prevUrls } });
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setFiles({ image: null, audio: null, video: null });
    Object.values(prevUrls).forEach(u => {
      if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
    });
    setPrevUrls({});
  }

  const hasFiles = files.image || files.audio || files.video;

  return (
    <div className="flex-shrink-0 pb-4 px-0">

      {/* Recording overlay */}
      {recState && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 gap-5">

          {/* Live camera preview — only for video */}
          {recState.type === 'video' && (
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-80 h-52 rounded-2xl object-cover border border-white/10 bg-black"
            />
          )}

          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-danger rec-pulse" />
            <span className="text-white/70 text-sm">
              Recording {recState.type}...
            </span>
          </div>
          <div className="font-serif text-6xl font-light text-white tracking-wide">
            {formatSecs(recState.secs)}
          </div>
          <div className="flex gap-3">
            <button onClick={cancelRecord}
              className="px-5 py-2.5 border border-white/20 rounded-lg text-white/50 text-sm hover:border-white/40 transition-colors">
              Cancel
            </button>
            <button onClick={stopRecord}
              className="px-8 py-2.5 bg-danger rounded-lg text-white text-sm hover:bg-red-700 transition-colors">
              ■ Stop &amp; Use
            </button>
          </div>
        </div>
      )}

      {/* Input box */}
      <div className="bg-bg2 border border-b2 rounded-2xl px-3 py-2.5 focus-within:border-accent transition-colors">

        {/* File previews */}
        {hasFiles && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.image && prevUrls.image && (
              <div className="relative inline-block">
                <img src={prevUrls.image} className="w-14 h-14 object-cover rounded-lg border border-b2" />
                <button onClick={() => removeFile('image')}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-bg2 border border-b2 rounded-full flex items-center justify-center text-[9px] text-t2 hover:bg-danger hover:text-white">
                  ✕
                </button>
              </div>
            )}
            {['audio', 'video'].map(t => files[t] && (
              <div key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-bg3 border border-b2 rounded-lg text-xs text-t2">
                {t === 'audio' ? '🎙️' : '📹'} {files[t].name.substring(0, 20)}
                <button onClick={() => removeFile(t)} className="text-t3 hover:text-danger ml-1">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <div className="flex items-end gap-2">
          <textarea ref={textareaRef} value={text}
            onChange={e => { setText(e.target.value); grow(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }}}
            placeholder="Ask about any monument, temple, dynasty, or artefact..."
            rows={1}
            className="flex-1 bg-transparent text-t1 text-sm outline-none resize-none max-h-[120px] leading-relaxed placeholder:text-t3"
          />
          <button onClick={send} disabled={disabled}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl text-white text-sm transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#C4934A,#8B6A35)' }}>
            ➤
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 pt-2 mt-2 border-t border-b1">
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPlusOpen(o => !o)}
              className="w-7 h-7 flex items-center justify-center border border-b2 rounded-lg text-t2 text-lg hover:border-accent hover:text-accent transition-all">
              +
            </button>
            {plusOpen && (
              <div className="absolute bottom-full left-0 mb-2 bg-bg2 border border-b2 rounded-xl w-52 shadow-xl z-50 py-1 slide-up">
                <PlusItem icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>} label="Add files or photos">
  <input type="file" accept="*/*" className="absolute inset-0 opacity-0 cursor-pointer"
    onChange={e => attachFileSmart(e)} />
</PlusItem>
                <PlusItem icon="🎙️" label="Record Audio" onClick={() => startRecord('audio')} />
                <PlusItem icon="📹" label="Record Video" onClick={() => startRecord('video')} />
                <div className="h-px bg-b1 my-1" />
                <div className="relative group">
                  <div
                    onClick={isGuest ? guestBlock : undefined}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-t2 hover:bg-bg3 hover:text-t1 cursor-pointer transition-colors"
                  >
                    <span className="w-5 flex items-center justify-center">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </span>
                    <span>Use style</span>
                    <span className="ml-auto text-t3 text-xs">›</span>
                  </div>
                  {/* Submenu — hidden for guests */}
                  {!isGuest && (
                    <div className="absolute bottom-0 left-full ml-1 bg-bg2 border border-b2 rounded-xl w-44 shadow-xl z-[60] py-1 hidden group-hover:block">
                      {TONES.map(t => (
                        <div key={t.id}
                          onClick={e => { e.stopPropagation(); setTone(t.id); setPlusOpen(false); }}
                          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${
                            tone === t.id ? 'text-accent' : 'text-t2 hover:bg-bg3 hover:text-t1'
                          }`}>
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                          {tone === t.id && <span className="ml-auto text-accent text-xs">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center text-t3 text-[11px] mt-2">
        Text · Image · Audio · Video — any combination
      </div>
    </div>
  );
}

function PlusItem({ icon, label, onClick, children }) {
  return (
    <div onClick={onClick}
      className="relative flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-t2 hover:bg-bg3 hover:text-t1 cursor-pointer transition-colors">
      <span className="w-5 flex items-center justify-center">{icon}</span>
      <span>{label}</span>
      {children}
    </div>
  );
}