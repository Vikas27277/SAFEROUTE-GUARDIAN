import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/useStore';

export default function CopilotPanel() {
  const { fastestRoute, saferRoute, activeRouteId, origin, destination, travelTime } = useStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const hasRoutes = fastestRoute != null;

  const autoExplainedId = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (hasRoutes && fastestRoute?.id !== autoExplainedId.current) {
      autoExplainedId.current = fastestRoute.id;
      // Clear messages on new route
      setMessages([]);
      handleSend("Please provide a short 2-sentence summary comparing these routes.", true);
    }
  }, [hasRoutes, fastestRoute]);

  const handleSend = async (questionText, isAuto = false) => {
    if (!questionText.trim() || !hasRoutes) return;

    if (!isAuto) {
      const newMsg = { role: 'user', content: questionText };
      setMessages(prev => [...prev, newMsg]);
    }
    setInput('');
    setLoading(true);

    try {
      const activeRoute = activeRouteId === saferRoute?.id ? saferRoute : fastestRoute;
      
      const buildLifelineContext = (r) => {
        if (!r?.lifeline?.perChunk?.length) return null;
        const worstDist = r.lifeline.worstDistanceKm;
        let nearestAtWorst = 'None';
        if (worstDist < 999) {
          const chunk = r.lifeline.perChunk.find(c => Math.abs(c.distanceToHelpKm - worstDist) < 0.001);
          if (chunk?.nearestRefuge) {
            nearestAtWorst = `${chunk.nearestRefuge.name} (${chunk.nearestRefuge.type})`;
          }
        }
        return {
          longestUnprotectedStretchM: Math.round(r.lifeline.longestUnprotectedStretchKm * 1000),
          worstDistanceToHelpM: worstDist >= 999 ? 'No open refuge available' : Math.round(worstDist * 1000),
          nearestRefugeAtWorst: nearestAtWorst
        };
      };

      const context = {
        origin: origin?.label,
        destination: destination?.label,
        travelTime: travelTime,
        fastestRoute: {
          time: fastestRoute.travelTimeMin,
          safetyScore: fastestRoute.safetyScore,
          cost: fastestRoute.routeCost,
          distance: fastestRoute.distanceKm,
          crossedZones: fastestRoute.crossedZones,
          riskBreakdown: fastestRoute.riskBreakdown,
          lifeline: buildLifelineContext(fastestRoute)
        },
        saferRoute: saferRoute ? {
          time: saferRoute.travelTimeMin,
          safetyScore: saferRoute.safetyScore,
          cost: saferRoute.routeCost,
          distance: saferRoute.distanceKm,
          crossedZones: saferRoute.crossedZones,
          riskBreakdown: saferRoute.riskBreakdown,
          extraTravelTime: saferRoute.travelTimeMin - fastestRoute.travelTimeMin,
          safetyScoreImprovement: saferRoute.safetyScore - fastestRoute.safetyScore,
          lifeline: buildLifelineContext(saferRoute)
        } : null,
        currentlySelectedRoute: activeRoute === saferRoute ? 'Safer Route' : 'Fastest Route'
      };

      const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
      const res = await fetch(`${apiBase}/api/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionText, context })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to communicate with Copilot');
      }

      setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
    } catch (err) {
      console.error(err);
      let fallbackText = "I couldn't reach the AI service right now, but here's what I know based on the route data: ";
      if (saferRoute) {
        const fStretch = Math.round((fastestRoute.lifeline?.longestUnprotectedStretchKm || 0) * 1000);
        const sStretch = Math.round((saferRoute.lifeline?.longestUnprotectedStretchKm || 0) * 1000);
        fallbackText += `The safer route improves your safety score by ${Math.round(saferRoute.safetyScore - fastestRoute.safetyScore)} points. `;
        if (sStretch < fStretch) {
          fallbackText += `It also has a shorter unprotected stretch (${sStretch}m vs ${fStretch}m), meaning it has lower isolation and more nearby help.`;
        } else {
          fallbackText += `It adds ${Math.round(saferRoute.travelTimeMin - fastestRoute.travelTimeMin)} mins to your trip.`;
        }
      } else {
        const fStretch = Math.round((fastestRoute.lifeline?.longestUnprotectedStretchKm || 0) * 1000);
        fallbackText += `This is the fastest route with a safety score of ${Math.round(fastestRoute.safetyScore)}. Its longest stretch without nearby help is ${fStretch}m.`;
      }
      setMessages(prev => [...prev, { role: 'ai', content: fallbackText }]);
    } finally {
      setLoading(false);
    }
  };

  if (!hasRoutes) return null;

  return (
    <div className="w-full glass-card bg-[var(--color-sr-secondary)] rounded-2xl flex flex-col h-full flex-1 overflow-hidden shadow-2xl border border-[var(--color-sr-border)] relative">
      <div className="p-4 border-b border-[var(--color-sr-border)] bg-[var(--color-sr-elevated)] backdrop-blur-md flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[var(--color-sr-text-muted)] via-[var(--color-sr-accent)] to-[var(--color-sr-text-muted)] opacity-80"></div>
        <div className="flex items-center gap-2">
          <span className="text-xl filter drop-shadow-[0_0_8px_rgba(197,202,210,0.5)]">✨</span>
          <h2 className="font-bold text-[var(--color-sr-text-primary)] tracking-wide text-sm drop-shadow-sm">AI Safety Assistant</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 bg-transparent custom-scrollbar min-h-[250px]">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-[var(--color-sr-text-secondary)] mt-2 flex flex-col h-full justify-center">
            <p className="mb-6 font-medium text-[var(--color-sr-text-primary)] drop-shadow-sm">I'm your AI Safety Assistant. Ask me anything about the routes!</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleSend("Why is the safer route better?")}
                className="glass-panel p-3.5 rounded-xl border border-[var(--color-sr-border)] hover:border-[var(--color-sr-border-strong)] transition-all text-xs text-left shadow-inner flex justify-between items-center group text-[var(--color-sr-text-primary)] hover:bg-[var(--color-sr-elevated)]"
              >
                <span className="font-medium tracking-wide">"Why is the safer route better?"</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-sr-accent)]">→</span>
              </button>
              <button 
                onClick={() => handleSend("How much extra time?")}
                className="glass-panel p-3.5 rounded-xl border border-[var(--color-sr-border)] hover:border-[var(--color-sr-border-strong)] transition-all text-xs text-left shadow-inner flex justify-between items-center group text-[var(--color-sr-text-primary)] hover:bg-[var(--color-sr-elevated)]"
              >
                <span className="font-medium tracking-wide">"How much extra time?"</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-sr-accent)]">→</span>
              </button>
              <button 
                onClick={() => handleSend("What risks are on the fastest route?")}
                className="glass-panel p-3.5 rounded-xl border border-[var(--color-sr-border)] hover:border-[var(--color-sr-border-strong)] transition-all text-xs text-left shadow-inner flex justify-between items-center group text-[var(--color-sr-text-primary)] hover:bg-[var(--color-sr-elevated)]"
              >
                <span className="font-medium tracking-wide">"What risks are on the fastest route?"</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-sr-accent)]">→</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`p-4 rounded-2xl text-[13px] max-w-[85%] leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-[var(--color-sr-elevated)] text-[var(--color-sr-text-primary)] self-end rounded-br-sm shadow-md border border-[var(--color-sr-border)] backdrop-blur-md' 
                : msg.role === 'error'
                  ? 'bg-red-500/10 text-red-200 self-start border border-red-500/30 rounded-bl-sm backdrop-blur-md'
                  : 'bg-[var(--color-sr-secondary)] text-[var(--color-sr-text-primary)] self-start border border-[var(--color-sr-border)] rounded-bl-sm shadow-sm backdrop-blur-md'
            }`}>
              {msg.content}
            </div>
          ))
        )}
        
        {loading && (
          <div className="bg-[var(--color-sr-secondary)] border border-[var(--color-sr-border)] text-[var(--color-sr-text-secondary)] p-4 rounded-2xl rounded-bl-sm text-sm self-start flex items-center gap-2 backdrop-blur-md">
            <div className="flex gap-1.5">
              <span className="w-1.5 h-1.5 bg-[var(--color-sr-accent-light)] rounded-full animate-bounce shadow-[0_0_5px_rgba(226,229,234,0.5)]" style={{animationDelay: '0ms'}}></span>
              <span className="w-1.5 h-1.5 bg-[var(--color-sr-accent)] rounded-full animate-bounce shadow-[0_0_5px_rgba(197,202,210,0.5)]" style={{animationDelay: '150ms'}}></span>
              <span className="w-1.5 h-1.5 bg-[var(--color-sr-accent-light)] rounded-full animate-bounce shadow-[0_0_5px_rgba(226,229,234,0.5)]" style={{animationDelay: '300ms'}}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-[var(--color-sr-border)] bg-[var(--color-sr-main)] backdrop-blur-md">
        <div className="flex gap-3 relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Ask about the routes..."
            className="flex-1 premium-input rounded-xl p-3.5 text-sm"
            disabled={loading}
          />
          <button 
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="premium-button px-5 py-3.5 rounded-xl transition-all font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-sr-text-primary)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </div>
        <p className="text-[9px] text-[var(--color-sr-text-secondary)] text-center mt-3 uppercase tracking-wider font-bold">Responses are generated by AI and may not be accurate.</p>
      </div>
    </div>
  );
}
