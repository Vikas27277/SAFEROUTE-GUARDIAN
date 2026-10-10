import React, { useEffect, useState } from 'react';
import { useStore } from '../state/useStore';
import { useCommunityReportsStore } from '../state/useCommunityReportsStore';

export default function ActiveRoutePrompt() {
  const { routes, activeRouteId, status } = useStore();
  const { setSelectedReportId } = useCommunityReportsStore();
  
  const [shownRouteId, setShownRouteId] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const activeRoute = routes.find(r => r.id === activeRouteId);

  useEffect(() => {
    if (status === 'ready' && activeRoute) {
      if (activeRoute.activeCommunityReportCount > 0 && shownRouteId !== activeRouteId) {
        setIsVisible(true);
        setShownRouteId(activeRouteId);
        
        // Auto-dismiss after 10s
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, 10000);
        return () => clearTimeout(timer);
      } else if (activeRoute.activeCommunityReportCount === 0) {
        setIsVisible(false);
      }
    }
  }, [activeRouteId, activeRoute, status, shownRouteId]);

  if (!isVisible || !activeRoute || activeRoute.activeCommunityReportCount === 0) return null;

  return (
    <div className="absolute top-24 right-6 z-50 glass-card bg-[#1a0f12]/90 border-[var(--color-sr-border)] border-l-4 border-l-red-500 text-red-200 p-5 rounded-2xl shadow-[0_10px_40px_rgba(239,68,68,0.1)] backdrop-blur-xl w-80 transform transition-all translate-x-0 animate-slide-up">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2 text-red-400 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Hazard Ahead
        </h3>
        <button onClick={() => setIsVisible(false)} className="text-[var(--color-sr-text-secondary)] hover:text-white transition-colors bg-[var(--color-sr-elevated)] rounded-full p-1 border border-[var(--color-sr-border)]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <p className="text-xs text-[var(--color-sr-text-secondary)] mb-4 leading-relaxed">
        There are <strong className="text-[var(--color-sr-text-primary)] font-black">{activeRoute.activeCommunityReportCount}</strong> verified community reports along your route. 
        Please drive carefully.
      </p>
      {activeRoute.contributingCommunityReportIds?.length > 0 && (
        <button 
          onClick={() => {
            setSelectedReportId(activeRoute.contributingCommunityReportIds[0]);
            setIsVisible(false);
          }}
          className="w-full premium-button text-red-400 hover:text-red-300 text-xs py-2.5 rounded-lg font-bold transition-all flex justify-center items-center gap-2 border border-red-500/20"
        >
          View Nearest Report
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
    </div>
  );
}
