import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

const IntroAnimation = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    // Cinematic Sequence timing (7-9 seconds total)
    const timers = [
      setTimeout(() => setStage(1), 2000), // 2s: Route appears
      setTimeout(() => setStage(2), 4000), // 4s: Protection takes shape (Shield)
      setTimeout(() => setStage(3), 6000), // 6s: Brand reveal
      setTimeout(() => {
        setStage(4); // 8s: Fade out
      }, 8500),
      setTimeout(() => onComplete(), 9500) // 9.5s: Unmount
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const handleSkip = () => {
    setSkipped(true);
    setTimeout(() => onComplete(), 600);
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0d0f12] transition-opacity duration-1000 ease-in-out ${
        (stage === 4 || skipped) ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Skip Button */}
      <button 
        onClick={handleSkip}
        className="absolute top-6 right-6 text-gray-500 hover:text-white text-xs md:text-sm font-medium tracking-[0.2em] flex items-center gap-2 transition-colors z-50 focus:outline-none focus:ring-2 focus:ring-gray-600 rounded px-2 py-1"
      >
        SKIP <ArrowRight size={16} />
      </button>

      <div className="relative w-full max-w-2xl aspect-[2/1] flex flex-col items-center justify-center">
        
        {/* Scene A: City & Woman (0-2s) */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-1500 ${
            stage >= 2 ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
          }`}
        >
          {/* Subtle City Skyline */}
          <svg viewBox="0 0 400 200" className="w-full h-full opacity-30 absolute">
            <path d="M 0 160 L 40 160 L 40 120 L 70 120 L 70 90 L 100 90 L 100 140 L 150 140 L 150 100 L 190 100 L 190 70 L 220 70 L 220 130 L 270 130 L 270 110 L 320 110 L 320 150 L 370 150 L 370 120 L 400 120 L 400 200 L 0 200 Z" fill="url(#cityGrad)" />
            <defs>
              <linearGradient id="cityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1f2937" stopOpacity="0"/>
                <stop offset="100%" stopColor="#1f2937" stopOpacity="0.8"/>
              </linearGradient>
            </defs>
          </svg>
          
          {/* Confident Woman Silhouette (moving right) */}
          <svg viewBox="0 0 100 200" className="absolute h-32 md:h-48 bottom-[10%] drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ animation: 'walkRight 6s ease-out forwards' }}>
            <g fill="#D1D5DB">
              {/* Head */}
              <circle cx="55" cy="30" r="11" />
              {/* Ponytail trailing left */}
              <path d="M46 25 Q 25 25 30 45 Q 40 40 45 35 Z" />
              {/* Torso/Dress */}
              <path d="M48 43 Q 65 50 60 130 L 30 130 Q 30 80 42 43 Z" />
              {/* Back Leg (Left) */}
              <path d="M40 130 L 35 190 L 45 195 L 50 130 Z" />
              {/* Front Leg (Right, stepping forward) */}
              <path d="M55 130 L 70 180 L 60 185 L 45 130 Z" />
              {/* Back Arm (Left, swinging back) */}
              <path d="M52 50 L 35 85 L 43 90 L 58 60 Z" />
              {/* Front Arm (Right, swinging forward) */}
              <path d="M55 55 L 75 80 L 68 85 L 50 65 Z" />
            </g>
          </svg>
        </div>

        {/* Scene B: The Route Appears (2-4s) */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
            stage >= 1 && stage < 2 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <svg viewBox="0 0 400 200" className="w-full h-full drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]">
            <path 
              d="M 50,150 C 120,140 150,100 200,100 S 280,120 350,80" 
              fill="none" 
              stroke="#E5E7EB" 
              strokeWidth="2"
              strokeLinecap="round"
              className={stage >= 1 ? 'draw-route-anim' : ''}
              style={{ strokeDasharray: 500, strokeDashoffset: stage >= 1 ? 0 : 500 }}
            />
            {/* Location Pulse */}
            <circle cx="350" cy="80" r="4" fill="#FFFFFF" className={`transition-opacity duration-500 delay-[1.5s] ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
              <animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        {/* Scene C: Protection (Shield) Takes Shape (4-6s) */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-1500 ${
            stage >= 2 ? 'opacity-100 transform scale-100' : 'opacity-0 transform scale-75'
          }`}
        >
          <svg width="80" height="80" viewBox="0 0 24 24" className="text-gray-200 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={stage >= 2 ? 'draw-shield-anim' : ''}
              style={{ strokeDasharray: 100, strokeDashoffset: stage >= 2 ? 0 : 100 }}
            />
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              fill="currentColor"
              className="transition-opacity duration-1000 ease-out delay-500"
              style={{ opacity: stage >= 2 ? 0.15 : 0 }}
            />
          </svg>
        </div>
      </div>

      {/* Scene D: Brand Reveal (6-8s) */}
      <div className="flex flex-col items-center mt-12 space-y-4 md:space-y-6 h-32">
        <h1 className="text-3xl md:text-5xl font-light tracking-[0.3em] text-gray-300 intro-text-glow flex flex-col md:flex-row items-center gap-2 md:gap-4">
          <span 
            className={`transition-all duration-1000 transform ${
              stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            SAFEROUTE
          </span>
          <span 
            className={`font-semibold text-white metallic-text transition-all duration-1000 delay-300 transform ${
              stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            GUARDIAN
          </span>
        </h1>
        
        <p 
          className={`text-gray-400 font-light tracking-[0.1em] text-sm md:text-lg italic transition-all duration-1000 delay-700 transform ${
            stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          Every journey deserves to feel safer.
        </p>
      </div>
    </div>
  );
};

export default IntroAnimation;
