import React, { useState } from 'react';
import { useAuthStore } from '../state/useAuthStore';
import AuthPanel from './AuthPanel';

export default function Header({ onReplayIntro }) {
  const { isAuthenticated, currentUser, signOut } = useAuthStore();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/5">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--color-sr-accent-light)] flex items-center gap-2 tracking-tight">
            <span className="text-2xl drop-shadow-md">🛡️</span> SAFEROUTE
          </h1>
          <span className="hidden md:inline-block text-[10px] font-bold bg-[var(--color-sr-secondary)] text-[var(--color-sr-text-muted)] px-2.5 py-1 rounded tracking-widest border border-[var(--color-sr-border)] uppercase shadow-inner">
            Demo • Synthetic Data
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {onReplayIntro && (
            <button 
              onClick={onReplayIntro} 
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              title="Replay Intro"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          )}
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-[#9CA3AF]">{currentUser?.email}</span>
              <button onClick={signOut} className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors">Sign Out</button>
            </div>
          ) : (
            <div className="relative">
              <button 
                onClick={() => setShowAuth(!showAuth)}
                className="premium-button text-sm font-medium text-[var(--color-sr-text-primary)] px-4 py-2 rounded"
              >
                Sign In
              </button>
              {showAuth && (
                <div className="absolute top-full right-0 mt-2 w-80 glass-card p-4 rounded border border-white/10 shadow-2xl">
                  <AuthPanel />
                </div>
              )}
            </div>
          )}
        </div>
        
        <button 
          className="md:hidden text-[#F5F7FA] p-2 hover:bg-white/5 rounded"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {showMobileMenu && (
        <div className="md:hidden glass-card border-t border-white/5 p-4 flex flex-col gap-4 animate-slide-up">
           {isAuthenticated ? (
            <div className="flex flex-col gap-4">
              <span className="text-sm text-[#9CA3AF]">{currentUser?.email}</span>
              <button onClick={signOut} className="text-sm font-medium text-red-400 text-left">Sign Out</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
               <AuthPanel />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
