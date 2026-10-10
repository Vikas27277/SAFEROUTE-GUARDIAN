# SafeRoute Guardian: Hackathon Pitch Script

**Duration**: ~2-3 Minutes
**Presenter**: Start with the SafeRoute Guardian dashboard open and empty.

---

### 1. The Problem (0:00 - 0:30)

*"Hello everyone! Today we're excited to present SafeRoute Guardian. When we use standard navigation apps late at night, they optimize purely for speed. They don't care if the fastest route takes you down an unlit alley, through an industrial zone, or an area with a history of incidents."*

*"We believe navigation should optimize for people, not just for time. SafeRoute Guardian introduces safety-aware navigation, ensuring that your route home is a safer corridor, not just the fastest one."*

### 2. The Solution & Risk Engine (0:30 - 1:15)

*(Click `Load Demo Trip`)*
*"Let's look at a late-night trip across Bengaluru. It's 10:30 PM."*

*(Click `Find Safer Route`)*
*"When we calculate the route, our engine doesn't just ask Mapbox for the fastest path. We pull multiple route geometries and run a real-time spatial analysis against known risk zones using Turf.js. We apply a Risk Penalty formula based on the severity of the zones crossed and the time of day."*

### 3. The Trade-off (1:15 - 1:45)

*(Point to the Route Comparison Card)*
*"Here you can clearly see the core value proposition of SafeRoute Guardian: The Time-vs-Safety Trade-off."*

*"The standard Fastest Route takes about 18 minutes, but it has a Safety Score of only 58 because it cuts through a high-risk red zone. However, our engine identified a Safer Route. By adding just 3 extra minutes to the trip (21 minutes total), the Safety Score jumps to 94, completely avoiding the highest-risk areas."*

*(Click `Switch to Safer Route`)*
*"With one click, the user can choose the lower-risk corridor."*

### 4. Gemini AI Copilot (1:45 - 2:15)

*"To make this data more accessible, we integrated the Gemini Safety Assistant."*

*(Type/Select: "Why is the safer route better?")*
*"The Copilot acts as a context-aware safety advisor. It understands the exact routes, times, and scores on the screen, and can explain exactly why the engine recommended the safer route in plain English."*

### 5. SOS & Conclusion (2:15 - 2:45)

*"Finally, for absolute emergencies, we've built a one-touch SOS system. *(Click `SOS — Demo Simulation` and Start)*. If triggered, it automatically begins a countdown, sends alerts, and notifies emergency contacts with the live location."*

*(Point to the disclaimer at the top)*
*"For this demo, all risk data is synthetic, but the spatial analysis architecture is fully capable of ingesting real-world municipal datasets. SafeRoute Guardian proves that we don't have to choose between getting there fast and getting there safe. Thank you!"*
