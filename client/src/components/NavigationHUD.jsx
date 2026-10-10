import React, { useState, useEffect } from 'react';
import { useStore } from '../state/useStore';
import * as turf from '@turf/turf';

export default function NavigationHUD() {
  const { 
    isNavigating, 
    currentLocation, 
    gpsStatus, 
    gpsAccuracy, 
    activeRouteId, 
    routes, 
    endNavigation,
    isFollowing,
    setIsFollowing
  } = useStore();

  const [zones, setZones] = useState(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [approachingRedZone, setApproachingRedZone] = useState(false);
  const [offRouteCounter, setOffRouteCounter] = useState(0);

  useEffect(() => {
    if (isNavigating) {
      fetch('/zones.bengaluru.geojson')
        .then(r => r.json())
        .then(z => setZones(z))
        .catch(console.error);
    }
  }, [isNavigating]);

  const activeRoute = routes.find(r => r.id === activeRouteId);
  let distanceRemainingText = '-- km';
  let etaText = '-- min';

  if (activeRoute && currentLocation) {
    try {
      const line = turf.lineString(activeRoute.geometry.coordinates);
      const point = turf.point(currentLocation);
      const snapped = turf.nearestPointOnLine(line, point);
      
      // Calculate distance to route (Off-Route Detection)
      const distToRoute = turf.distance(point, snapped, { units: 'kilometers' });
      
      // Calculate remaining distance
      const totalLength = turf.length(line, { units: 'kilometers' });
      const sliced = turf.lineSlice(turf.point(activeRoute.geometry.coordinates[0]), snapped, line);
      const traveled = turf.length(sliced, { units: 'kilometers' });
      const remainingDistance = Math.max(0, totalLength - traveled);
      
      distanceRemainingText = `${remainingDistance.toFixed(1)} km`;

      const avgSpeedKmh = activeRoute.distanceKm / (activeRoute.durationMin / 60);
      const remainingTimeMin = (remainingDistance / avgSpeedKmh) * 60;
      etaText = `${Math.ceil(remainingTimeMin)} min`;

      // Red Zone Detection
      let inRedZone = false;
      if (zones) {
        // Buffer the point by 50 meters to provide a small proximity warning
        const ptBuffer = turf.buffer(point, 0.05, { units: 'kilometers' });
        
        for (const feature of zones.features) {
          if (feature.properties.risk === 'red') {
            // Check if user's buffered point intersects the red zone
            if (turf.booleanIntersects(ptBuffer, feature)) {
              inRedZone = true;
              break;
            }
          }
        }
      }
      
      // Update state without infinite loops (React 16+ handles this during render if necessary, but better to use useEffect. Wait, doing state updates in render is bad. Let's do it cleanly).
    } catch (e) {
      console.warn("Error calculating navigation metrics:", e);
    }
  }

  // We need a useEffect for state updates derived from currentLocation
  useEffect(() => {
    if (!activeRoute || !currentLocation) return;
    try {
      const line = turf.lineString(activeRoute.geometry.coordinates);
      const point = turf.point(currentLocation);
      const snapped = turf.nearestPointOnLine(line, point);
      const distToRoute = turf.distance(point, snapped, { units: 'kilometers' });
      
      if (distToRoute > 0.05) { // 50 meters
        setOffRouteCounter(c => c + 1);
        if (offRouteCounter > 2) {
          setIsOffRoute(true);
        }
      } else {
        setOffRouteCounter(0);
        setIsOffRoute(false);
      }

      let inRedZone = false;
      if (zones) {
        const ptBuffer = turf.buffer(point, 0.05, { units: 'kilometers' });
        for (const feature of zones.features) {
          if (feature.properties.risk === 'red' && turf.booleanIntersects(ptBuffer, feature)) {
            inRedZone = true;
            break;
          }
        }
      }
      setApproachingRedZone(inRedZone);

    } catch (e) {}
  }, [currentLocation, activeRoute, zones]);

  if (!isNavigating) return null;

  const getStatusColor = () => {
    switch(gpsStatus) {
      case 'live': return 'text-emerald-400';
      case 'weak': return 'text-yellow-400';
      case 'locating': return 'text-blue-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="absolute top-0 left-0 w-full z-50 pointer-events-none animate-fade-in flex flex-col items-center pt-4 px-4 gap-4">
      {/* Top HUD */}
      <div className="pointer-events-auto bg-[#0B0F12]/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-full max-w-md">
        
        {isOffRoute && (
          <div className="bg-red-950/80 border-b border-red-900/50 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-red-400 uppercase tracking-widest">Off Route Detected</p>
              <p className="text-xs text-red-300">You have deviated from the safe route. Proceed with caution.</p>
            </div>
          </div>
        )}

        {approachingRedZone && !isOffRoute && (
          <div className="bg-yellow-950/80 border-b border-yellow-900/50 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-900/50 flex items-center justify-center flex-shrink-0 animate-pulse">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-yellow-400 uppercase tracking-widest">Caution</p>
              <p className="text-xs text-yellow-300">Entering or near a high-risk red zone.</p>
            </div>
          </div>
        )}
        
        <div className="p-4 bg-gradient-to-r from-[var(--color-sr-main)] to-black flex justify-between items-center border-b border-white/5">
          <div className="flex flex-col">
            <span className="text-3xl font-bold tracking-tight text-white">{distanceRemainingText}</span>
            <span className="text-sm font-medium text-[var(--color-sr-text-muted)] uppercase tracking-wider">Remaining</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-semibold text-[var(--color-sr-accent)]">{etaText}</span>
            <span className="text-xs text-[var(--color-sr-text-muted)]">ETA</span>
          </div>
        </div>

        <div className="p-3 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${gpsStatus === 'live' ? 'bg-emerald-400 animate-pulse' : (gpsStatus === 'locating' ? 'bg-blue-400 animate-pulse' : 'bg-red-400')}`}></div>
            <span className={`text-xs font-bold uppercase tracking-wider ${getStatusColor()}`}>
              GPS: {gpsStatus} {gpsAccuracy && `(±${Math.round(gpsAccuracy)}m)`}
            </span>
          </div>

          <div className="flex gap-2">
            {!isFollowing && (
              <button 
                onClick={() => setIsFollowing(true)}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-sr-accent)]/20 text-[var(--color-sr-accent)] text-xs font-bold uppercase tracking-wider border border-[var(--color-sr-accent)]/30 hover:bg-[var(--color-sr-accent)]/30 transition-colors"
              >
                Recenter
              </button>
            )}
            <button 
              onClick={endNavigation}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-wider border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              End
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
