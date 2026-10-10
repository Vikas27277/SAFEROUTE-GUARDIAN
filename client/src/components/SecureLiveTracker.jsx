import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function SecureLiveTracker({ trackingToken }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!import.meta.env.VITE_MAPBOX_TOKEN) return;
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [77.5946, 12.9716], // Default center (Bangalore)
      zoom: 12
    });

    const el = document.createElement('div');
    el.className = 'w-6 h-6 bg-red-500 rounded-full border-4 border-white shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse';
    
    markerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([77.5946, 12.9716])
      .addTo(mapRef.current);

    return () => mapRef.current.remove();
  }, []);

  useEffect(() => {
    let interval;

    const fetchLocation = async () => {
      try {
        const res = await fetch(`/api/sos/track/${trackingToken}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to load tracking data');
        }
        
        const data = await res.json();
        setSession(data);

        if (data.location && data.location.lat && data.location.lng && mapRef.current) {
          markerRef.current.setLngLat([data.location.lng, data.location.lat]);
          
          // Pan to location if it's the first load or if the map hasn't been interacted with recently
          mapRef.current.flyTo({ center: [data.location.lng, data.location.lat], zoom: 15, duration: 1000 });
        }
      } catch (err) {
        setError(err.message);
      }
    };

    fetchLocation();
    
    // Poll every 3 seconds
    interval = setInterval(fetchLocation, 3000);

    return () => clearInterval(interval);
  }, [trackingToken]);

  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-red-500 mb-2">Tracking Unavailable</h1>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative flex flex-col bg-[#0a0a0a]">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent p-6 pt-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-white font-bold text-xl flex items-center gap-2">
              <span className="text-red-500 animate-pulse">🚨</span> SafeRoute Guardian SOS
            </h1>
            {session && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase ${session.status === 'active' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-gray-800 text-gray-400'}`}>
                {session.status}
              </span>
            )}
          </div>
          
          {session && (
            <div className="text-sm text-gray-300 mt-2 bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 w-max shadow-lg">
              <div className="flex flex-col gap-1">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Status Information</span>
                <span>Session started: {new Date(session.startedAt).toLocaleTimeString()}</span>
                
                {session.location && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${session.isStale ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                    <span className={session.isStale ? 'text-yellow-400 font-medium' : 'text-green-400'}>
                      {session.isStale ? 'Location Stale (Outdated)' : 'Live Location Active'}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      (Updated {new Date(session.location.timestamp).toLocaleTimeString()})
                    </span>
                  </div>
                )}

                {session.status === 'ended' && (
                  <div className="mt-2 text-green-400 font-bold border-t border-white/10 pt-2">
                    ✅ The user has marked themselves as safe.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="flex-1 w-full" />
    </div>
  );
}
