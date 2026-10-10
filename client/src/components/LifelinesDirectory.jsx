import React, { useState } from 'react';
import { useStore } from '../state/useStore';
import { Shield, Fuel, Navigation, X, Info } from 'lucide-react';
import { Activity } from 'lucide-react'; // Cross is not in lucide-react sometimes, Activity/Plus is safer, or Hospital. We will use Shield, Plus, Fuel.
import * as turf from '@turf/turf';

// Use standard lucide icons
const HospitalIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

export default function LifelinesDirectory({ onClose }) {
  const refuges = useStore(state => state.refuges);
  const currentLifelinePos = useStore(state => state.currentLifelinePos);
  
  const [filter, setFilter] = useState('all');

  const features = refuges?.features || [];

  const featuresWithDistance = features.map(f => {
    let dist = null;
    if (currentLifelinePos) {
      try {
        dist = turf.distance(
          turf.point(currentLifelinePos),
          f
        );
      } catch (e) {}
    }
    return { ...f, dist };
  }).sort((a, b) => (a.dist || 999) - (b.dist || 999));

  const filteredFeatures = filter === 'all' 
    ? featuresWithDistance 
    : featuresWithDistance.filter(f => f.properties.type === filter);

  const getIcon = (type) => {
    switch(type) {
      case 'hospital': return <HospitalIcon className="w-5 h-5 text-red-500" />;
      case 'pharmacy': return <HospitalIcon className="w-5 h-5 text-emerald-500" />;
      case 'police': return <Shield className="w-5 h-5 text-blue-500" />;
      case 'petrol': return <Fuel className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleFlyTo = (coords) => {
    window.dispatchEvent(new CustomEvent('flyToLocation', { detail: { coords, zoom: 16 } }));
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-[85vh] max-h-[600px] md:h-[500px] w-full bg-[#0B0F12]/95 backdrop-blur-md rounded-t-2xl md:rounded-lg overflow-hidden border border-white/10 shadow-2xl relative z-50">
      {/* Mobile drag indicator */}
      <div className="w-full flex justify-center pt-3 pb-1 md:hidden cursor-pointer" onClick={onClose}>
        <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
      </div>
      
      <div className="flex justify-between items-center p-4 pt-2 md:pt-4 border-b border-white/10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-400" />
          Nearby Lifelines Directory
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      <div className="flex p-3 gap-2 overflow-x-auto border-b border-white/5 custom-scrollbar shrink-0">
        {['all', 'hospital', 'police', 'pharmacy', 'petrol'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filter === type ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {filteredFeatures.length === 0 ? (
          <div className="text-center text-gray-500 p-8">No lifelines found in this area.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredFeatures.map((f, i) => (
              <div 
                key={f.properties.id || i}
                onClick={() => handleFlyTo(f.geometry.coordinates)}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
              >
                <div className="mt-1 bg-black/30 p-2 rounded-full shrink-0">
                  {getIcon(f.properties.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{f.properties.name || 'Unknown Name'}</h3>
                  <div className="text-xs text-gray-400 mt-1 capitalize">{f.properties.type}</div>
                  {f.properties.address && (
                    <div className="text-xs text-gray-500 mt-1 truncate">{f.properties.address}</div>
                  )}
                </div>
                {f.dist !== null && (
                  <div className="text-xs font-mono text-blue-400 shrink-0">
                    {f.dist.toFixed(1)} km
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
