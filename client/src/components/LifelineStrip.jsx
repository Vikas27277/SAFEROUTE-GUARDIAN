import React, { useState, useEffect } from 'react';
import * as turf from '@turf/turf';
import { useStore } from '../state/useStore';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';
import LifelinesDirectory from './LifelinesDirectory';

export default function LifelineStrip() {
  const activeRouteId = useStore(state => state.activeRouteId);
  const routes = useStore(state => state.routes);
  const setCurrentLifelinePos = useStore(state => state.setCurrentLifelinePos);

  const activeRoute = routes.find(r => r.id === activeRouteId);
  
  const [scrubValue, setScrubValue] = useState(0);
  const [showDirectory, setShowDirectory] = useState(false);

  // Reset scrubber when route changes
  useEffect(() => {
    setScrubValue(0);
    if (activeRoute && activeRoute.geometry) {
      try {
        const pt = turf.along(activeRoute.geometry, 0, { units: 'kilometers' });
        setCurrentLifelinePos(pt.geometry.coordinates);
      } catch (err) {
        console.error('LifelineStrip turf.along reset error:', err);
      }
    } else {
      setCurrentLifelinePos(null);
    }
  }, [activeRouteId, activeRoute, setCurrentLifelinePos]);

  // Handle scrubber change
  const handleScrub = (e) => {
    const val = parseFloat(e.target.value);
    setScrubValue(val);
    
    if (activeRoute && activeRoute.geometry) {
      try {
        // Safe check to avoid over-length error in Turf
        const len = turf.length(activeRoute.geometry, { units: 'kilometers' });
        const safeVal = Math.min(val, len);
        const pt = turf.along(activeRoute.geometry, safeVal, { units: 'kilometers' });
        setCurrentLifelinePos(pt.geometry.coordinates);
      } catch (err) {
        console.error('LifelineStrip turf.along scrub error:', err);
      }
    }
  };

  if (!activeRoute || !activeRoute.lifeline || !activeRoute.lifeline.perChunk) {
    return (
      <div className="glass-panel p-5 rounded-xl shadow-lg border border-[var(--color-sr-border)] text-[var(--color-sr-text-secondary)] text-xs text-center flex items-center justify-center min-h-[100px]">
        Select a route to view its lifeline analysis.
      </div>
    );
  }

  const { lifeline, km } = activeRoute;
  const { perChunk, longestUnprotectedStretchKm, worstDistanceKm } = lifeline;
  
  if (perChunk.length === 0) {
    return (
      <div className="glass-panel p-5 rounded-xl shadow-lg border border-[var(--color-sr-border)] text-[var(--color-sr-text-secondary)] text-xs text-center flex items-center justify-center min-h-[100px]">
        No Lifeline segments found for this route.
      </div>
    );
  }

  const { refugeRadiusKm, maxHelpDistanceKm } = DEFAULT_CONFIG.lifeline;

  // Find current chunk
  let currentChunk = perChunk[0];
  for (let i = perChunk.length - 1; i >= 0; i--) {
    if (perChunk[i].cumulativeKm <= scrubValue) {
      currentChunk = perChunk[i];
      break;
    }
  }

  const formatMeters = (kmVal) => {
    if (kmVal >= 999 || kmVal == null) return 'No help';
    if (kmVal < 1) return `${Math.round(kmVal * 1000)}m`;
    return `${kmVal.toFixed(1)}km`;
  };

  const totalKm = km || (perChunk[perChunk.length - 1].cumulativeKm + 0.1);

  return (
    <div className="glass-panel p-5 rounded-xl shadow-2xl border border-[var(--color-sr-border)] animate-fade-in">
      <h3 className="font-bold tracking-widest text-[10px] uppercase text-[var(--color-sr-text-secondary)] mb-4 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-[var(--color-sr-text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        Lifeline Connection
      </h3>
      
      {/* Sparkline & Scrubber */}
      <div className="relative h-8 mb-4">
        {/* SVG Sparkline */}
        <div className="absolute inset-0 w-full h-full rounded overflow-hidden flex">
          {perChunk.map((chunk, i) => {
            const nextKm = i < perChunk.length - 1 ? perChunk[i+1].cumulativeKm : totalKm;
            const chunkLength = nextKm - chunk.cumulativeKm;
            const widthPct = (chunkLength / totalKm) * 100;
            
            let color = '#ef4444'; // Red
            if (chunk.distanceToHelpKm <= refugeRadiusKm) color = '#10b981'; // Green
            else if (chunk.distanceToHelpKm <= maxHelpDistanceKm) color = '#eab308'; // Yellow

            return (
              <div 
                key={i} 
                style={{ width: `${Math.max(widthPct, 0.1)}%`, backgroundColor: color }}
                className="h-full opacity-80"
              />
            );
          })}
        </div>
        
        {/* Scrubber overlay */}
        <input 
          type="range"
          min="0"
          max={totalKm}
          step={totalKm / 100}
          value={scrubValue}
          onChange={handleScrub}
          aria-label="Route position scrubber"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        
        {/* Thumb indicator */}
        <div 
          className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,1)] pointer-events-none"
          style={{ left: `${Math.min((scrubValue / totalKm) * 100, 100)}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Legend */}
      <div className="flex justify-between items-center text-[9px] uppercase font-bold tracking-wider text-[var(--color-sr-text-secondary)] mb-5 border-b border-[var(--color-sr-border)] pb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
          Nearby help
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></span>
          Lower isolation
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span>
          Higher isolation
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="text-[9px] font-bold uppercase text-[var(--color-sr-text-secondary)] mb-1">Longest Unprotected Stretch</div>
          <div className="text-sm font-black text-[var(--color-sr-text-primary)]">
            {formatMeters(longestUnprotectedStretchKm)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase text-[var(--color-sr-text-secondary)] mb-1">Worst Distance to Help</div>
          <div className="text-sm font-black text-[var(--color-sr-text-primary)]">
            {formatMeters(worstDistanceKm)}
          </div>
        </div>
      </div>

      {/* Nearest Refuge */}
      <div className="bg-[var(--color-sr-secondary)] rounded-xl p-4 border border-[var(--color-sr-border)] shadow-inner">
        <div className="text-[9px] font-bold uppercase text-[var(--color-sr-text-secondary)] mb-2 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-[var(--color-sr-accent)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
          Nearest open refuge
        </div>
        {currentChunk && currentChunk.nearestRefuge && currentChunk.distanceToHelpKm < 999 ? (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold text-[var(--color-sr-text-primary)] text-sm">
                {currentChunk.nearestRefuge.name}
              </div>
              <div className="text-xs text-[var(--color-sr-text-secondary)] capitalize mt-0.5">
                {currentChunk.nearestRefuge.type}
              </div>
            </div>
            <div className="text-[var(--color-sr-accent)] font-black text-sm drop-shadow-sm">
              {formatMeters(currentChunk.distanceToHelpKm)}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--color-sr-text-secondary)] italic">No open refuge nearby</div>
        )}
        
        <button 
          onClick={() => setShowDirectory(true)}
          className="mt-3 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2"
        >
          View All Nearby Lifelines
        </button>
      </div>

      {showDirectory && (
        <div className="fixed inset-0 z-[100] md:absolute md:inset-auto md:w-full md:left-0 md:-top-4 md:flex md:flex-col md:justify-end md:block">
          {/* Mobile backdrop */}
          <div className="absolute inset-0 bg-black/60 md:hidden backdrop-blur-sm" onClick={() => setShowDirectory(false)} />
          
          {/* Drawer container */}
          <div className="absolute bottom-0 inset-x-0 md:relative w-full shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-slide-up md:animate-none">
            <LifelinesDirectory onClose={() => setShowDirectory(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
