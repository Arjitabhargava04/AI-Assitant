// src/components/MessageBubble.jsx
import { useState, useRef } from 'react';
import { authFetch, renderMarkdown } from '../utils/api';

let globalAudio = null;

export function UserBubble({ content, imageUrl, audioName, videoName }) {
  return (
    <div className="flex gap-2 flex-row-reverse">
      <div className="w-7 h-7 rounded-full bg-bg3 border border-b2 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
        👤
      </div>
      <div className="max-w-[calc(100%-36px)]">
        <div className="text-[10px] text-t3 mb-1 text-right">You</div>
        <div className="px-4 py-3 bg-ubg border border-b2 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
          {imageUrl && (
            <div className="mb-2">
              <img src={imageUrl} alt="upload"
                className="max-w-[240px] max-h-[180px] rounded-xl object-cover border border-b2 block" />
            </div>
          )}
          {audioName && <div className="text-t2 text-xs mb-1">🎙️ {audioName}</div>}
          {videoName && <div className="text-t2 text-xs mb-1">📹 {videoName}</div>}
          {content && <p className="text-t1">{content}</p>}
        </div>
      </div>
    </div>
  );
}

export function AIBubble({ content, tone, images, showCorrection, geminiSummary, onSaveCorrection }) {
  const [speakState, setSpeakState]   = useState('idle'); // idle | loading | playing
  const [corrOpen, setCorrOpen]       = useState(false);
  const [corrText, setCorrText]       = useState('');
  const [corrSaved, setCorrSaved]     = useState(false);
  const audioRef = useRef(null);

  async function handleSpeak() {
    // If playing — stop
    if (speakState === 'playing') {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (globalAudio)      { globalAudio.pause(); globalAudio = null; }
      setSpeakState('idle');
      return;
    }
    // If loading — ignore double click
    if (speakState === 'loading') return;

    // Stop any other playing audio
    if (globalAudio) { globalAudio.pause(); globalAudio = null; }

    setSpeakState('loading');
    try {
      const res  = await authFetch('/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, voice: 'Aoede' }),
      });
      const data = await res.json();
      if (data.audio_b64) {
        const audio    = new Audio('data:audio/wav;base64,' + data.audio_b64);
        audioRef.current = audio;
        globalAudio      = audio;
        setSpeakState('playing');
        audio.play();
        audio.onended = () => { setSpeakState('idle'); globalAudio = null; audioRef.current = null; };
      } else throw new Error('No audio');
    } catch {
      setSpeakState('idle');
    }
  }

  async function handleSaveCorrection() {
    if (!corrText.trim()) return;
    await onSaveCorrection(geminiSummary, corrText);
    setCorrSaved(true);
    setCorrOpen(false);
  }

  const speakLabel = speakState === 'loading' ? '⏳ Loading...'
                   : speakState === 'playing' ? '■ Stop'
                   : '🔊 Speak';

  return (
    <div className="flex gap-2">
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
          <div className="md-content"
               dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />

          {/* Image grid */}
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

        {/* Action buttons */}
        <div className="flex gap-2 mt-1.5 flex-wrap">
          <button onClick={handleSpeak}
            className={`flex items-center gap-1 px-3 py-1 border rounded-md text-xs transition-all ${
              speakState === 'playing'
                ? 'border-accent text-accent bg-ag'
                : 'border-b2 text-t3 hover:border-accent hover:text-accent'
            }`}>
            {speakLabel}
          </button>

          {/* Admin correction buttons */}
          {showCorrection && !corrSaved && (
            <>
              <button onClick={() => setCorrOpen(false)}
                className="flex items-center gap-1 px-3 py-1 border border-green-800 text-green-500 rounded-md text-xs hover:bg-green-950/30 transition-all">
                ✓ Correct
              </button>
              <button onClick={() => setCorrOpen(o => !o)}
                className="flex items-center gap-1 px-3 py-1 border border-red-800 text-danger rounded-md text-xs hover:bg-red-950/30 transition-all">
                ✗ Wrong
              </button>
            </>
          )}
          {corrSaved && (
            <span className="text-xs text-accent px-3 py-1">✓ Correction saved</span>
          )}
        </div>

        {/* Correction input */}
        {corrOpen && !corrSaved && (
          <div className="mt-2 p-3 bg-bg3 border border-accent2 rounded-xl">
            <div className="text-xs text-t3 mb-2">Type the correct answer:</div>
            <textarea value={corrText} onChange={e => setCorrText(e.target.value)}
              placeholder="Write the correct version of this answer..."
              className="w-full bg-transparent text-t1 text-sm outline-none resize-none min-h-[80px] placeholder:text-t3"
            />
            <div className="flex justify-end mt-2">
              <button onClick={handleSaveCorrection}
                className="px-4 py-1.5 bg-accent hover:bg-accent2 rounded-lg text-white text-xs transition-colors">
                Save Correction
              </button>
            </div>
          </div>
        )}
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
