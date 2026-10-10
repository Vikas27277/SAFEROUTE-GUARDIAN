# SafeRoute Guardian

Safety-aware navigation for Bengaluru. This project analyzes map routes against risk zones to provide a safer corridor.

## Local Development

### 1. Backend Setup
The backend requires a Gemini API key for the AI Safety Assistant.

```bash
cd server
npm install
```

Create a `server/.env` file with the following variables:
```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Start the backend:
```bash
npm start
```

### 2. Frontend Setup
The frontend requires a Mapbox public token for routing and maps.

```bash
cd client
npm install
```

Create a `client/.env.local` file with the following variables:
```env
VITE_MAPBOX_TOKEN=your_mapbox_public_token_here
VITE_API_BASE=http://localhost:3000
```

Start the frontend:
```bash
npm run dev
```

## Production Deployment

### 1. Build Frontend
To deploy the frontend to a static host (like Vercel, Netlify, or Firebase Hosting):

```bash
cd client
npm install
npm run build
```
Upload the `/client/dist` folder to your hosting provider. Make sure to configure the provider's environment variables:
- `VITE_MAPBOX_TOKEN`
- `VITE_API_BASE` (set to your production backend URL)

### 2. Start Backend
To deploy the backend to a Node.js hosting service (like Render, Heroku, or Fly.io):

```bash
cd server
npm install
npm start
```
Make sure to configure the production environment variables:
- `PORT` (usually provided automatically by the host)
- `GEMINI_API_KEY` (your private API key)
- `GEMINI_MODEL` (e.g., gemini-2.5-flash)
- `CORS_ORIGIN` (set to your production frontend URL to restrict API access)
