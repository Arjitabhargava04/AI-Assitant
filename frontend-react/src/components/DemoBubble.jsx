// src/components/DemoBubble.jsx
// Beautiful AI response bubble for guest demo messages.
// Includes: hero banner image, title, markdown content, and CTA box with login buttons.

import { renderMarkdown } from '../utils/api';

export default function DemoBubble({ heroImage, title, content, cta, onLoginClick, onSignupClick }) {
  return (
    <div className="flex gap-2.5">
      {/* AI Avatar */}
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold text-white mt-0.5"
        style={{
          background: 'linear-gradient(135deg, #C4934A, #8B6A35)',
          fontFamily: "'Cormorant Garamond', serif",
        }}
      >
        V
      </div>

      <div className="flex-1 min-w-0 max-w-2xl">
        {/* Label */}
        <div className="text-[10px] text-t3 mb-1">Vikramaditya AI</div>

        {/* Bubble */}
        <div
          className="overflow-hidden border border-b1 rounded-2xl"
          style={{
            background: 'rgba(19, 18, 16, 0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderTopLeftRadius: '4px',
          }}
        >
          {/* Hero image banner */}
          {heroImage && (
            <div
              style={{
                width: '100%',
                aspectRatio: '16 / 7',
                backgroundImage: `url(${heroImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderBottom: '0.5px solid #1F1F1F',
              }}
            />
          )}

          {/* Body */}
          <div className="p-4">
            {/* Title */}
            {title && (
              <h3
                className="font-serif mb-2"
                style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  color: '#E8E2D9',
                }}
              >
                {title}
              </h3>
            )}

            {/* Markdown content */}
            <div
              className="demo-bubble-content text-t1"
              style={{ fontSize: '13.5px', lineHeight: 1.65 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content || '') }}
            />

            {/* CTA Box */}
            {cta && (
              <div
                className="mt-4 p-3.5 rounded-xl"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(196,147,74,0.08), rgba(196,147,74,0.02))',
                  border: '0.5px solid rgba(196,147,74,0.25)',
                }}
              >
                <div
                  className="font-serif italic mb-2.5"
                  style={{
                    fontSize: '14px',
                    color: '#A8A097',
                    lineHeight: 1.5,
                  }}
                >
                  {cta}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={onSignupClick || onLoginClick}
                    className="font-semibold transition-all hover:opacity-90"
                    style={{
                      padding: '8px 18px',
                      background: 'linear-gradient(135deg, #C4934A, #8B6A35)',
                      color: '#1A1208',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Sign Up Free
                  </button>
                  <button
                    onClick={onLoginClick}
                    className="transition-all"
                    style={{
                      padding: '8px 18px',
                      background: 'transparent',
                      color: '#C4934A',
                      border: '0.5px solid rgba(196,147,74,0.4)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(196,147,74,0.08)';
                      e.target.style.borderColor = '#C4934A';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                      e.target.style.borderColor = 'rgba(196,147,74,0.4)';
                    }}
                  >
                    Already have an account? Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Style overrides for demo bubble content */}
      <style>
        {`
          .demo-bubble-content p { margin-bottom: 8px; color: #E8E2D9; }
          .demo-bubble-content p:last-of-type { margin-bottom: 0; }
          .demo-bubble-content h3 {
            font-family: 'Cormorant Garamond', serif;
            font-size: 17px;
            font-weight: 500;
            color: #E8E2D9;
            margin: 12px 0 6px;
          }
          .demo-bubble-content h3:first-child { margin-top: 0; }
          .demo-bubble-content ul {
            padding-left: 20px;
            margin: 6px 0 10px;
            list-style: disc;
          }
          .demo-bubble-content li { margin-bottom: 3px; line-height: 1.55; }
          .demo-bubble-content strong { color: #C4934A; font-weight: 500; }
          .demo-bubble-content em {
            color: #A8A097;
            font-family: 'Cormorant Garamond', serif;
            font-style: italic;
          }
          .demo-bubble-content hr {
            border: none;
            border-top: 0.5px solid #2A2A2A;
            margin: 12px 0;
          }
        `}
      </style>
    </div>
  );
}