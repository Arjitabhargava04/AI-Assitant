// src/components/GuestLanding.jsx
// Welcome page shown to guests (not logged in) — with hero, search bar, and topic cards.
// Khajuraho temple background image.

import InputArea from './InputArea';
import { TOPIC_CARDS } from '../utils/demoResponses';

export default function GuestLanding({ onSendMessage, onTopicClick }) {

  // When guest sends a message via InputArea
  function handleInputAreaSend({ text }) {
    if (!text?.trim()) return;
    onSendMessage(text.trim());
  }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">

      {/* Background: faded Khajuraho temple */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/demo/khajuraho-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          backgroundRepeat: 'no-repeat',
          opacity: 0.18,
          filter: 'saturate(0.85) brightness(0.95)',
          zIndex: 0,
        }}
      />
      {/* Vignette overlay for readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(13,13,13,0.45) 65%, rgba(13,13,13,0.85) 100%), linear-gradient(180deg, rgba(13,13,13,0.55) 0%, transparent 25%, transparent 65%, rgba(13,13,13,0.85) 100%)',
          zIndex: 1,
        }}
      />

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto px-8 pt-16 pb-8">

          {/* ─── Hero ─── */}
          <div className="text-center mb-10" style={{ animation: 'guestFadeUp 0.6s ease both' }}>
            <h1
              className="font-serif text-t1 mb-2"
              style={{ fontSize: '46px', fontWeight: 400, lineHeight: 1.15, textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
            >
              Welcome to Vikramaditya{' '}
              <span style={{ color: '#C4934A', fontStyle: 'italic', fontWeight: 500 }}>AI</span>
            </h1>
            <p
              className="font-serif italic mb-5"
              style={{ fontSize: '21px', color: '#C4934A', fontWeight: 400, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
            >
              Your AI partner in Heritage &amp; Archaeology
            </p>
            <p
              className="max-w-xl mx-auto text-t2"
              style={{ fontSize: '13px', lineHeight: 1.7, textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}
            >
              Search, interpret, and discover insights from India's archaeological and historical wealth.
              Ask, explore, and preserve our heritage with the power of AI.
            </p>
          </div>

          {/* ─── Central Search Bar (real InputArea component) ─── */}
          <div className="max-w-2xl mx-auto mb-12" style={{ animation: 'guestFadeUp 0.6s 0.1s ease both' }}>
            <InputArea onSend={handleInputAreaSend} disabled={false} isGuest={true} />
          </div>

          {/* ─── Topic Cards ─── */}
          <div style={{ animation: 'guestFadeUp 0.6s 0.2s ease both' }}>
            <div className="font-serif text-t2 mb-4 px-1" style={{ fontSize: '16px', fontWeight: 500 }}>
              Explore Popular Topics
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {TOPIC_CARDS.map((card, i) => (
                <TopicCard
                  key={card.key}
                  card={card}
                  delayIndex={i}
                  onClick={() => onTopicClick(card.key)}
                />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Animations */}
      <style>
        {`
          @keyframes guestFadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes guestCardIn {
            from { opacity: 0; transform: translateY(18px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}

function TopicCard({ card, delayIndex, onClick }) {
  return (
    <div
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer border border-b2 rounded-2xl group"
      style={{
        aspectRatio: '1 / 1.15',
        background: '#1A1A1A',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: `guestCardIn 0.7s ${0.05 + delayIndex * 0.07}s ease both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = 'rgba(196,147,74,0.5)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.5), 0 0 24px rgba(196,147,74,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = '#2A2A2A';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Image */}
      <div
        className="absolute inset-0 transition-transform duration-500 group-hover:scale-110"
        style={{
          backgroundImage: `url(${card.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Dark overlay for text */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(13,13,13,0) 0%, rgba(13,13,13,0.2) 35%, rgba(13,13,13,0.85) 75%, rgba(13,13,13,0.95) 100%)',
        }}
      />
      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3.5">
        <div
          className="font-serif text-t1"
          style={{ fontSize: '15px', lineHeight: 1.25, fontWeight: 500, whiteSpace: 'pre-line' }}
        >
          {card.title}
        </div>
      </div>
    </div>
  );
}