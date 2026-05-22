// frontend-react/src/components/WipModal.jsx
// "Coming Soon" popup shown when user clicks a sidebar item that's not yet built.
// Used for: Search Archives, Maps & Sites, Timeline, Collections, Reports, Settings.

import { useEffect } from 'react';

export default function WipModal({ isOpen, featureName, onClose }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'wipFadeIn 0.2s ease',
      }}
    >
      {/* Modal body — stopPropagation so clicking inside doesn't close it */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '340px',
          background: '#111111',
          border: '0.5px solid #2A2A2A',
          borderRadius: '18px',
          padding: '32px 28px 24px',
          margin: '16px',
          textAlign: 'center',
          position: 'relative',
          animation: 'wipModalIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Close button (X) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '30px',
            height: '30px',
            background: '#1A1A1A',
            border: '0.5px solid #2A2A2A',
            color: '#A8A097',
            fontSize: '16px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >
          ✕
        </button>

        {/* Animated sparkle icon in spinning gold ring */}
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 18px',
            borderRadius: '50%',
            background:
              'linear-gradient(135deg, rgba(196,147,74,0.18), rgba(196,147,74,0.06))',
            border: '0.5px solid rgba(196,147,74,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Spinning conic gradient ring */}
          <div
            style={{
              position: 'absolute',
              inset: '-50%',
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(196,147,74,0.18) 90deg, transparent 180deg)',
              animation: 'wipSpin 3s linear infinite',
            }}
          />
          {/* Sparkle emoji */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              fontSize: '26px',
              lineHeight: 1,
            }}
          >
            ✨
          </div>
        </div>

        {/* "Coming Soon" title */}
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '22px',
            fontWeight: 500,
            color: '#E8E2D9',
            marginBottom: '6px',
          }}
        >
          Coming{' '}
          <span
            style={{
              color: '#C4934A',
              fontStyle: 'italic',
            }}
          >
            Soon
          </span>
        </h3>

        {/* Feature name (uppercase gold) */}
        <div
          style={{
            fontSize: '12px',
            color: '#C4934A',
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            marginBottom: '14px',
            fontWeight: 500,
          }}
        >
          {featureName || 'Feature'}
        </div>

        {/* Friendly description */}
        <p
          style={{
            fontSize: '13px',
            color: '#A8A097',
            lineHeight: 1.6,
            marginBottom: '22px',
            padding: '0 8px',
          }}
        >
          This feature is on its way. We're crafting it carefully to bring you
          the best heritage experience.
        </p>

        {/* "Got it" button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '11px',
            background: 'linear-gradient(135deg, #C4934A, #8B6A35)',
            color: '#1A1208',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.02em',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 8px 20px rgba(196,147,74,0.25)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          Got it
        </button>
      </div>

      {/* Inline keyframes (needed because we're using inline styles) */}
      <style>
        {`
          @keyframes wipFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes wipModalIn {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes wipSpin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}