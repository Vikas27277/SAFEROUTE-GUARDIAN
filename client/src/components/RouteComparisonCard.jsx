import React from 'react';
import { useStore } from '../state/useStore';

const ScoreCircle = ({ score, size = "w-12 h-12", strokeWidth = 3 }) => {
  if (!Number.isFinite(score)) {
    return <div className={`flex items-center justify-center rounded-full border border-gray-700 text-xs text-gray-500 ${size}`} aria-label="Safety score unavailable">N/A</div>;
  }
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colorClass = score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";

  return (
    <div className={`relative flex items-center justify-center ${size}`}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} className="text-gray-800" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" />
        <circle cx="18" cy="18" r={radius} className={`${colorClass} transition-all duration-1000 ease-out`} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} stroke="currentColor" fill="transparent" strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-bold text-gray-100">{Math.round(score)}</span>
    </div>
  );
};

export default function RouteComparisonCard() {
  const { fastestRoute, safestRoute, routes, riskCoverageAvailable, activeRouteId, setActiveRouteId, status, error } = useStore();

  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="w-full glass-card rounded-xl shadow-2xl border border-[var(--color-sr-border)] flex flex-col mb-6 overflow-hidden">
        <div className="bg-[var(--color-sr-secondary)] p-4 border-b border-[var(--color-sr-border)] flex justify-between items-center">
          <h3 className="font-bold text-sm tracking-widest uppercase text-[var(--color-sr-text-primary)]">Route Analysis</h3>
          <span className="text-[10px] bg-[var(--color-sr-elevated)] text-[var(--color-sr-accent-light)] px-2 py-0.5 rounded border border-[var(--color-sr-border)] uppercase tracking-widest font-bold animate-pulse">Analyzing...</span>
        </div>
        <div className="p-4 flex flex-col gap-4 animate-pulse">
          <div className="h-24 bg-[var(--color-sr-border)] rounded-lg"></div>
          <div className="h-24 bg-[var(--color-sr-border)] rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="w-full bg-[#111111] text-gray-100 rounded-xl shadow-2xl border border-red-900/50 flex flex-col mb-6 overflow-hidden">
        <div className="bg-[#1a1a1a] p-4 border-b border-red-900/50 flex justify-between items-center">
          <h3 className="font-bold text-sm tracking-widest uppercase text-red-400">Route Analysis Error</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-red-400 mb-3">{error || 'An unknown error occurred.'}</p>
        </div>
      </div>
    );
  }

  if (!fastestRoute) return null;

  const activeRoute = routes.find(route => route.id === activeRouteId) || fastestRoute;
  
  const formatStretch = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

  if (!activeRoute) return null; 

  return (
    <div className="w-full glass-panel text-[var(--color-sr-text-primary)] rounded-xl shadow-2xl flex flex-col mb-6 overflow-hidden">
      <div className="bg-[var(--color-sr-secondary)] p-4 border-b border-[var(--color-sr-border)] flex justify-between items-center">
        <h3 className="font-bold text-sm tracking-widest uppercase text-[var(--color-sr-text-primary)] flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-sr-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Route Analysis
        </h3>
        <div className="flex gap-2 items-center">
          {activeRoute?.riskBreakdown && (
            <span className="text-[10px] bg-[var(--color-sr-elevated)] text-[var(--color-sr-text-secondary)] px-2 py-0.5 rounded border border-[var(--color-sr-border)] uppercase tracking-wider font-bold" title="Time-of-day risk weighting">
              {activeRoute.riskBreakdown.timeBand} (×{activeRoute.riskBreakdown.timeBandMult})
            </span>
          )}
          <span className="text-[10px] bg-[var(--color-sr-elevated)] text-[var(--color-sr-accent-light)] px-2 py-0.5 rounded border border-[var(--color-sr-border)] uppercase tracking-widest font-bold">Analyzed</span>
        </div>
      </div>
      
      <div className="p-4 flex flex-col gap-4">
        {!riskCoverageAvailable && (
          <div role="status" className="bg-amber-950/40 border border-amber-700/50 p-3 rounded-lg text-xs text-amber-200">
            Routes are available, but safety scores are unavailable outside the Bengaluru synthetic-data coverage area.
          </div>
        )}
        <div className="flex flex-col gap-3">
          {/* Active Route Summary */}
          <div className={`p-4 rounded-xl border transition-all relative overflow-hidden ${activeRoute.id === safestRoute?.id ? 'bg-[var(--color-sr-accent)]/5 border-[var(--color-sr-accent)]/50 shadow-[0_0_30px_rgba(52,211,153,0.15)] scale-[1.02]' : 'bg-black/40 border-white/20'}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${activeRoute.id === safestRoute?.id ? 'bg-[var(--color-sr-accent)] shadow-[0_0_15px_rgba(52,211,153,1)]' : 'bg-[var(--color-sr-text-secondary)]'}`}></div>
            <div className="flex justify-between items-center mb-3">
              <p className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 drop-shadow-md ${activeRoute.id === safestRoute?.id ? 'text-[var(--color-sr-accent-light)]' : 'text-[var(--color-sr-text-secondary)]'}`}>
                {activeRoute.id === safestRoute?.id ? (
                  <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>{activeRoute.label}</>
                ) : activeRoute.label}
              </p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-wider uppercase shadow-md ${activeRoute.id === safestRoute?.id ? 'text-[var(--color-sr-main)] bg-[var(--color-sr-accent)]' : 'text-white bg-white/10 border border-white/5'}`}>Active</span>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{Math.round(activeRoute.travelTimeMin)}</span>
                <span className="text-sm font-medium text-sr-text-secondary">min</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-sr-text-secondary font-bold uppercase tracking-widest">Score</span>
                <ScoreCircle score={activeRoute.safetyScore} size="w-12 h-12" strokeWidth={4} />
              </div>
            </div>
            
            <div className="text-[10px] text-sr-text-secondary font-medium truncate bg-black/40 p-2 rounded flex flex-wrap gap-2 mb-2">
              <span>Dist: {activeRoute.distanceKm.toFixed(1)} km</span>
              {activeRoute.routeCost != null && <span>• Cost: {Math.round(activeRoute.routeCost)}</span>}
              {activeRoute.lifeline && <span>• Unprotected: {formatStretch(activeRoute.lifeline.longestUnprotectedStretchKm)}</span>}
            </div>

            {activeRoute.intersectsRedZone && (
              <div className="bg-red-950/40 border border-red-900/50 p-2 rounded text-[10px] text-red-400 font-bold flex items-center gap-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Warning: Route intersects {activeRoute.redZoneCount} red zone{activeRoute.redZoneCount > 1 ? 's' : ''} ({activeRoute.redZoneExposureDistance.toFixed(2)} km exposure)
              </div>
            )}
          </div>
        </div>

        {/* Alternative Routes List */}
        {routes.length > 1 && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-sr-text-secondary mb-1">Alternative Routes</p>
            {routes.filter(route => route.id !== activeRouteId).map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => setActiveRouteId(route.id)}
                className="w-full text-left p-3 rounded-lg border border-[var(--color-sr-border)] bg-[var(--color-sr-main)] hover:border-[var(--color-sr-border-strong)] transition-colors"
              >
                <div className="flex justify-between gap-3 items-center mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-sr-text-primary)]">{route.label}</span>
                </div>
                <div className="flex justify-between gap-3 items-baseline">
                  <span className="text-lg font-bold">{Math.round(route.travelTimeMin)} <span className="text-[10px] text-[var(--color-sr-text-secondary)]">min</span></span>
                  <span className="text-[10px] text-[var(--color-sr-text-secondary)]">{route.distanceKm.toFixed(1)} km</span>
                </div>
                <div className="mt-1 text-[10px] text-[var(--color-sr-text-muted)] flex flex-col gap-0.5">
                  <span>{route.safetyScore == null ? 'Score unavailable' : `Safety score ${Math.round(route.safetyScore)}`}</span>
                  {route.intersectsRedZone ? (
                    <span className="text-red-400 font-semibold flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Intersects {route.redZoneCount} red zone{route.redZoneCount > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-green-400 font-semibold flex items-center gap-1">
                       <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       Avoids all red zones
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected Route Breakdown */}
        <div className="glass-card p-4 rounded-xl mt-4 border border-white/5">
          <p className="text-[10px] font-bold tracking-widest uppercase mb-4 text-sr-text-secondary flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Risk Exposure (Active Route)
          </p>
          
          {activeRoute.exposureKm ? <div className="space-y-4">
            <div className="flex justify-between items-center group">
              <span className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span> 
                <span className="text-xs font-semibold text-white tracking-wide">RED <span className="text-sr-text-secondary font-normal ml-1">(High Risk)</span></span>
              </span>
              <span className="font-mono text-xs text-red-400 font-bold">{activeRoute.exposureKm?.red?.toFixed(2) || '0.00'} km</span>
            </div>
            <div className="flex justify-between items-center group">
              <span className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span> 
                <span className="text-xs font-semibold text-white tracking-wide">YELLOW <span className="text-sr-text-secondary font-normal ml-1">(Moderate)</span></span>
              </span>
              <span className="font-mono text-xs text-yellow-400 font-bold">{activeRoute.exposureKm?.yellow?.toFixed(2) || '0.00'} km</span>
            </div>
            <div className="flex justify-between items-center group">
              <span className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-sr-accent shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> 
                <span className="text-xs font-semibold text-white tracking-wide">GREEN <span className="text-sr-text-secondary font-normal ml-1">(Lower Risk)</span></span>
              </span>
              <span className="font-mono text-xs text-sr-accent font-bold">{activeRoute.exposureKm?.green?.toFixed(2) || '0.00'} km</span>
            </div>
          </div> : <p className="text-xs text-sr-text-secondary italic">Risk exposure is unavailable for this route's location.</p>}
        </div>

        {/* Start Trip Button */}
        <button 
          onClick={() => useStore.getState().setIsNavigating(true)}
          className="w-full mt-4 py-4 rounded-xl bg-[var(--color-sr-accent)] hover:bg-emerald-400 text-[var(--color-sr-main)] font-black uppercase tracking-widest flex justify-center items-center gap-2 transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] transform hover:-translate-y-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          Start Trip
        </button>
        
      </div>
    </div>
  );
}
