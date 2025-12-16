# Production Deployment Guide

## Environment Setup

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```bash
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-production-domain.com
```

### Frontend Environment Variables

Create a `.env.production` file in the `frontend` directory:

```bash
VITE_API_URL=https://your-api-domain.com
```

## Build Instructions

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install --production

# Frontend
cd ../frontend
npm install
```

### 2. Build Frontend

```bash
cd frontend
npm run build
```

This creates an optimized production build in `frontend/dist/`.

### 3. Start Backend

```bash
cd backend
npm start
```

The backend will:

- Serve the API on `/api/*` routes
- Serve the frontend static files from `../frontend/dist`
- Respond to all other routes with `index.html` (for client-side routing)

## Deployment Options

### Option 1: Single Server Deployment

Deploy both frontend and backend together:

1. Build the frontend: `npm run build` in frontend directory
2. Set `NODE_ENV=production` in backend
3. Start the backend server: `npm start` in backend directory
4. The backend automatically serves the built frontend

### Option 2: Separate Deployment

Deploy frontend and backend separately:

**Backend:**

1. Deploy to a Node.js hosting service (Heroku, Railway, DigitalOcean, etc.)
2. Set environment variables (PORT, NODE_ENV, FRONTEND_URL)
3. Run `npm start`

**Frontend:**

1. Build with: `npm run build`
2. Deploy `dist/` folder to static hosting (Vercel, Netlify, Cloudflare Pages, etc.)
3. Set `VITE_API_URL` environment variable to your backend URL

## ❄️ Free Tier Cold Start Handling

**Important for Free Tier Deployments (Render, Railway, Heroku Free, etc.):**

Free tier services put your app to sleep after ~15 minutes of inactivity. The first request after sleeping can take 10-30 seconds.

**Built-in Cold Start Features:**

- ✅ **Automatic Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
- ✅ **Extended Timeout**: 60-second timeout for initial requests
- ✅ **Warmup Endpoint**: `/warmup` endpoint for health checks
- ✅ **User-Friendly Error Messages**: Clear feedback about cold start delays

**Best Practices:**

1. **Use a Keep-Alive Service** (optional):
   - [Cron-job.org](https://cron-job.org) - Free ping service
   - Ping `/health` or `/warmup` every 10 minutes to keep server awake
2. **User Communication**:

   - The app automatically shows "Server is waking up" messages
   - First load after sleep: 10-30 seconds
   - Subsequent loads: Fast (cached)

3. **Testing Cold Starts**:
   ```bash
   # Wait 15+ minutes for sleep, then test
   curl https://your-api-domain.com/warmup
   ```

## Performance Optimizations

### Backend

- ✅ File-based caching for weather data (reduces API calls by ~90%)
- ✅ Sequential API fetching prevents rate limits
- ✅ 2-minute server timeout for long-running requests
- ✅ Regional filtering reduces data transfer
- ✅ Coordinate rounding reduces unique weather locations

### Frontend

- ✅ Vite production build with tree-shaking and minification
- ✅ Cesium is loaded from CDN (included in index.html)
- ✅ Smart balloon sampling for performance
- ✅ Progress indicators for better UX

## Production Checklist

- [ ] Set environment variables for both frontend and backend
- [ ] Update CORS origin in backend to production frontend URL
- [ ] Build frontend with production API URL
- [ ] Test health endpoint: `https://your-api-domain.com/health`
- [ ] Verify cache directory exists and is writable: `backend/cache/`
- [ ] Monitor first load time (30-60 seconds for initial weather data fetch)
- [ ] Verify subsequent loads are fast (2-3 seconds with cache)
- [ ] Test regional filtering with different coordinates
- [ ] Verify balloon limit controls work properly

## Monitoring

### Health Check

```bash
curl https://your-api-domain.com/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "env": "production"
}
```

### Cache Management

- Cache location: `backend/cache/weather-cache.json`
- Cache automatically expires daily
- Coordinate rounding creates ~50 unique locations for 900+ balloons
- First load: 30-60 seconds
- Cached load: 2-3 seconds

### Performance Metrics

- Initial balloon load: 30-60 seconds (with weather API calls)
- Subsequent loads: 2-3 seconds (cached)
- Default balloon limit: 50 (adjustable 10-200)
- Default region radius: 2000 km (adjustable 500-5000 km)

## Troubleshooting

### "Server is waking up from sleep" / "Server is starting up"

- **Expected on free tier** - Cold start takes 10-30 seconds
- Wait 15-30 seconds and try again
- The app will automatically retry 3 times
- Consider using a keep-alive service to prevent sleep

### "Server is not responding"

- Check backend server is running
- Verify VITE_API_URL in frontend points to correct backend URL
- Check CORS configuration allows frontend origin
- If on free tier, server may be sleeping (wait 30 seconds)

### "Too many requests" errors

- Should not occur with sequential fetching
- Check cache is working properly
- Verify delay timings (400ms between locations, 200ms between pressure levels)

### Slow initial load

- Expected behavior for first load (30-60 seconds)
- Weather data is fetched for ~50 unique locations
- Subsequent loads will be fast due to caching

### No balloons displayed

- Check browser console for errors
- Verify regional filter parameters (lat/lon/radius)
- Try increasing balloon limit or radius
- Check API response with network tab

## Security Notes

- API keys are not required (using free Open-Meteo API)
- CORS is configured for frontend origin only
- Environment files (.env) are gitignored
- Production error messages hide stack traces
