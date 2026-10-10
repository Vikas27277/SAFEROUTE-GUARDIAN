import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import { getRefuges } from './services/refugeProvider.js';
import communityRoutes from './routes/community.js';
import telegramRoutes from './routes/telegram.js';
import sosRoutes from './routes/sos.js';
import contactsRoutes from './routes/contacts.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configured origin from env, fallback to localhost for dev
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({
  origin: corsOrigin
}));

// Limit request size to 1MB (to handle route coordinates, but not excessively large payloads)
app.use(express.json({ limit: '1mb' }));

// Basic rate limiting: max 20 requests per window (15 mins)
const copilotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: 'Too many requests, please try again later.' }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', communityRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/contacts', contactsRoutes);

// Rate limiter for search endpoint
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many search requests, please try again later.' }
});

app.get('/api/places/search', searchLimiter, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters long.' });
    }
    
    if (q.length > 100) {
      return res.status(400).json({ error: 'Search query is too long (max 100 characters).' });
    }
    
    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey) {
      console.warn('TOMTOM_API_KEY is not configured in environment variables');
      return res.status(503).json({ error: 'Search service is currently unavailable.' });
    }
    
    // TomTom Fuzzy Search API (v2); without countrySet, TomTom searches globally.
    const url = new URL(`https://api.tomtom.com/search/2/search/${encodeURIComponent(q.trim())}.json`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('limit', '7');
    url.searchParams.set('typeahead', 'true');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }
    
    if (!response.ok) {
      console.warn(`TomTom search failed with HTTP ${response.status}`);
      if (response.status === 429) {
        return res.status(429).json({ error: 'Place search is temporarily rate limited. Please wait and try again.', code: 'TOMTOM_RATE_LIMITED' });
      }
      if (response.status === 401 || response.status === 403) {
        return res.status(502).json({ error: 'TomTom rejected the server credentials. Check TOMTOM_API_KEY and its Search API access.', code: 'TOMTOM_AUTH_FAILED' });
      }
      return res.status(502).json({ error: 'TomTom place search is temporarily unavailable. Please try again.', code: 'TOMTOM_UPSTREAM_ERROR' });
    }
    
    let data;
    try {
      data = await response.json();
    } catch {
      return res.status(502).json({ error: 'TomTom returned an invalid response. Please try again.', code: 'TOMTOM_INVALID_RESPONSE' });
    }

    if (!data || !Array.isArray(data.results)) {
      return res.status(502).json({ error: 'TomTom returned an invalid place list. Please try again.', code: 'TOMTOM_INVALID_RESPONSE' });
    }
    
    const normalized = data.results.flatMap(item => {
      const latitude = item.position?.lat;
      const longitude = item.position?.lon;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

      const address = item.address || {};
      const locality = [
        address.municipality,
        address.countrySubdivisionName || address.countrySubdivision,
        address.country
      ].filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ');
      const formattedAddress = address.freeformAddress || locality;
      const name = item.poi?.name || address.streetName || formattedAddress;
      const label = formattedAddress && name && !formattedAddress.includes(name)
        ? `${name}, ${formattedAddress}`
        : (formattedAddress || name);

      if (!label) return [];
      return [{ name, address: formattedAddress || locality, label, coords: [longitude, latitude] }];
    });
    
    res.json(normalized);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Search provider took too long to respond.' });
    }
    console.error('Places search API request failed:', error);
    res.status(500).json({ error: 'Failed to search places.' });
  }
});

app.get('/api/refuges', async (req, res) => {
  try {
    const { routeGeometry, travelTime, mode } = req.query;
    
    // In a real app we might parse geometry, but for now we pass the queries
    const refuges = await getRefuges({ routeGeometry, travelTime, mode });
    
    res.json(refuges);
  } catch (error) {
    console.error('Failed to get refuges:', error);
    res.status(500).json({ error: 'Failed to fetch refuges' });
  }
});

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.post('/api/copilot', copilotLimiter, async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required and must not be empty.' });
    }

    if (question.length > 500) {
      return res.status(400).json({ error: 'Question is too long (max 500 characters).' });
    }
    
    if (!context) {
      return res.status(400).json({ error: 'Route context is required.' });
    }

    const systemInstruction = `
      You are the SafeRoute Guardian AI Safety Assistant.
      You must answer the user's question ONLY based on the provided route context.
      
      CRITICAL RULES:
      1. NEVER invent incidents, crime statistics, businesses, opening hours, or locations.
      2. NEVER claim a route is "safe", "guaranteed safe", "100% safe", "crime-free", or has "no danger". Always use terms like "safer", "lower-risk", "higher-risk", "lower isolation", "less isolated", or "more nearby help".
      3. The risk-zone and refuge/Lifeline data provided in the context may be synthetic/demo data. You must clearly mention that it is synthetic or demo data when discussing specific zones or refuges. NEVER present synthetic data as confirmed real-world information.
      4. DO NOT provide emergency claims or guarantees.
      5. If the answer cannot be determined from the provided context, state clearly that you cannot determine it.
      6. "Lifeline" measures proximity to available/open refuge points (hospitals, police, pharmacies, petrol stations). A route with lower isolation (shorter unprotected stretch) is preferable when other factors are comparable.
      
      ROUTE CONTEXT:
      ${JSON.stringify(context, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: question,
      config: {
        systemInstruction,
        temperature: 0.2
      }
    });

    return res.json({ answer: response.text });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Failed to process request with AI.' });
  }
});

if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

export default app;
