# SafeRoute Guardian: Hackathon Demo Checklist

Follow this checklist to ensure a flawless live presentation.

## BEFORE DEMO

### 1. Pre-Flight Checks
- [ ] Ensure you have a stable internet connection.
- [ ] Verify both `client/.env.local` and `server/.env` contain correct API keys (Mapbox & Gemini).
- [ ] Start the backend server (`npm start` in `/server`).
- [ ] Start the frontend dev server (`npm run dev` in `/client`).
- [ ] Verify the frontend successfully loads in your browser (`http://localhost:5173`).
- [ ] Check the browser console and terminal for any critical errors.

### 2. Service Checks
- [ ] **Mapbox Check**: Ensure the map renders and you can pan/zoom.
- [ ] **Routing Check**: Click `Load Demo Trip` and then `Find Safer Route` to confirm Mapbox routing and Turf.js risk analysis work.
- [ ] **Gemini Check**: Ask the Copilot "Why is the safer route better?" and ensure it responds accurately based on context.

---

## LIVE DEMO

This is the exact sequence to follow on stage.

1. **Load Demo Trip**
   - Click the `Load Demo Trip` button.
   - Explain to the judges: *"We are simulating a late-night trip (10:30 PM) across Bengaluru."*
2. **Find Safer Route**
   - Click the `Find Safer Route` button.
   - Explain that the engine is pulling Mapbox routes and instantly calculating Risk Penalties against our synthetic risk zones.
3. **Explain Fastest Route**
   - Point out the Fastest Route on the comparison card.
   - Note the Travel Time (approx. 18 min) and its Safety Score (approx. 58).
4. **Explain Safer Route**
   - Point out the Safer Route on the comparison card.
   - Highlight the trade-off: *"By adding just 3 minutes (approx. 21 min), the Safety Score jumps to 94, avoiding high-risk red zones."*
5. **Switch to Safer Route**
   - Click `Switch to Safer Route`.
   - Show how the map instantly highlights the recommended safer corridor in neon green.
6. **Ask Gemini Safety Assistant**
   - Type or select a pre-populated question: *"Why is the safer route better?"*
   - Show the judges the AI analyzing the specific context of this trip without fabricating real-world data.
7. **Run SOS Simulation**
   - Click `SOS — Demo Simulation`.
   - Start the simulation, let the countdown run, and explain the automated emergency flow (contacts notified, help dispatched).
   - Reiterate that this is a safe, local simulation for the demo.

---

## BACKUP PLAN

In case live APIs fail during the presentation:

- **Mapbox Failure (Routing/Geocoding)**: If routing times out due to internet issues, fall back to explaining the UI concepts, the Risk Penalty formula, and the Turf.js spatial architecture.
- **Gemini Failure**: The main routing and analysis features operate entirely independent of Gemini. Simply state: *"Our AI Copilot is currently unreachable, but the core risk-engine remains fully operational."*
- **Complete Network Failure**: Pre-record a 1-minute video of the working demo beforehand. Have it open in a background tab ready to play if the live demo breaks.
