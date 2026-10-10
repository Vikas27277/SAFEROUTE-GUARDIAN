import React, { useState } from 'react';
import { useStore } from '../state/useStore';
import { lineString, length } from '@turf/turf';

const LayersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
    <polyline points="2 12 12 17 22 12"></polyline>
    <polyline points="2 17 12 22 22 17"></polyline>
  </svg>
);

const RulerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const AlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-yellow-500">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

export default function MapControls() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    mapStyle, setMapStyle,
    showTraffic, setShowTraffic,
    showTerrain, setShowTerrain,
    showTransit, setShowTransit,
    isMeasuring, setIsMeasuring,
    measurementPoints, clearMeasurementPoints,
    isNavigating
  } = useStore();

  if (isNavigating) return null; // Hide during navigation

  const handleStyleChange = (e) => {
    setMapStyle(e.target.value);
  };
  
  let distance = 0;
  if (measurementPoints.length > 1) {
    const line = lineString(measurementPoints);
    distance = length(line, { units: 'kilometers' });
  }

  return (
    <div className="absolute top-4 right-14 z-40 flex flex-col gap-2 items-end">
      {/* Layer Button */}
      <div className="relative">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 bg-[#0B0F12]/90 backdrop-blur border border-white/10 rounded-lg shadow-lg flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          title="Map Layers"
        >
          <LayersIcon />
        </button>
        
        {isOpen && (
          <div className="absolute top-0 right-12 w-64 bg-[#0B0F12]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="font-semibold text-white text-sm">Map Details</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
            </div>
            
            <div className="flex flex-col gap-2">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Map Type</span>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1.5 rounded transition-colors">
                <input type="radio" name="mapStyle" value="mapbox://styles/mapbox/dark-v11" checked={mapStyle.includes('dark-v11')} onChange={handleStyleChange} className="accent-blue-500 w-4 h-4"/>
                Default (Dark)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1.5 rounded transition-colors">
                <input type="radio" name="mapStyle" value="mapbox://styles/mapbox/satellite-v9" checked={mapStyle.includes('satellite-v9')} onChange={handleStyleChange} className="accent-blue-500 w-4 h-4"/>
                Satellite
              </label>
            </div>
            
            <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Overlays</span>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1.5 rounded transition-colors">
                <input type="checkbox" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} className="accent-green-500 w-4 h-4 rounded"/>
                Live Traffic
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1.5 rounded transition-colors">
                <input type="checkbox" checked={showTerrain} onChange={(e) => setShowTerrain(e.target.checked)} className="accent-green-500 w-4 h-4 rounded"/>
                3D Terrain
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1.5 rounded transition-colors">
                <input type="checkbox" checked={showTransit} onChange={(e) => setShowTransit(e.target.checked)} className="accent-blue-500 w-4 h-4 rounded"/>
                Public Transit
              </label>
              <label className="flex items-center gap-2 text-sm opacity-50 cursor-not-allowed p-1.5 rounded" title="Requires Air Quality Data Provider">
                <input type="checkbox" disabled className="accent-gray-500 w-4 h-4 rounded"/>
                Air Quality <AlertIcon />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Measurement Tool Button */}
      <div className="relative">
        <button 
          onClick={() => {
            setIsMeasuring(!isMeasuring);
            if (!isMeasuring) setIsOpen(false);
          }}
          className={`w-10 h-10 border border-white/10 rounded-lg shadow-lg flex items-center justify-center transition-colors ${isMeasuring ? 'bg-blue-600 text-white border-blue-400/50' : 'bg-[#0B0F12]/90 backdrop-blur text-white hover:bg-white/10'}`}
          title="Measure Distance"
        >
          <RulerIcon />
        </button>
      </div>

      {/* Measurement HUD */}
      {isMeasuring && (
        <div className="mt-1 bg-[#0B0F12]/95 backdrop-blur-xl border border-blue-500/30 rounded-lg p-3 text-xs w-48 shadow-lg">
          <div className="font-semibold text-blue-400 mb-1 flex justify-between items-center">
            Distance
            {measurementPoints.length > 0 && (
              <button onClick={clearMeasurementPoints} className="text-gray-400 hover:text-white px-1 underline">Clear</button>
            )}
          </div>
          <div className="text-gray-300">
            {measurementPoints.length === 0 && "Click map to add points."}
            {measurementPoints.length === 1 && "Click another point to measure."}
            {measurementPoints.length > 1 && (
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold text-white">{distance.toFixed(2)}</span>
                <span className="text-gray-400 font-medium">km (straight)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
