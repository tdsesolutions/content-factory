# TDS Content Factory

AI-powered TikTok content generation with KiarosX animated avatar.

## What It Does

- **Generates 5-10 TikTok videos daily** with animated KiarosX avatar
- **Talking avatar** in upper right corner with lip-sync and sound waves
- **Background music** with automatic ducking during speech
- **Auto-captions** with 60 templates across 10 content categories
- **Dashboard** to browse, preview, and download videos

## Features

### 🎭 KiarosX Avatar
- Floating glass sphere with "K" symbol
- 3 animation states: idle, talking, executing
- Sound wave ripples when speaking
- Cyan glow (#00E5FF) on indigo base (#0B1F3B)

### 🎬 Video Generation
- 9:16 TikTok format (1080x1920)
- Text-to-speech (neutral voice)
- Text overlays with typewriter animation
- 5 background music tracks with auto-ducking
- Canvas-based rendering (no external APIs)

### 📊 Dashboard
- Cyberpunk UI with glass-morphism
- Video gallery with previews
- Content calendar
- Stats tracking
- One-click download

### 🔄 Automation
- Daily auto-generation at 6 AM
- On-demand batch generation
- 7-day content rotation (no repeats)
- Download tracking

## Quick Start

```bash
npm install
npm start
```

Visit: http://localhost:3000

## Deploy to Vercel

### Option 1: Git Push (Recommended)
1. Push to GitHub (already done)
2. Go to https://vercel.com/new
3. Import `tdsesolutions/content-factory`
4. Deploy

### Option 2: Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

## Deploy to Nestify

```bash
./deploy.sh production
```

## File Structure

```
├── client/
│   ├── index.html              # Dashboard UI
│   └── js/
│       ├── avatar-engine.js    # KiarosX animation
│       ├── video-renderer.js   # Video composer
│       ├── audio-mixer.js      # Audio mixing
│       └── avatar-demo.html    # Avatar demo
├── server/
│   ├── server.js               # Express API
│   ├── content-generator.js    # Caption generator
│   ├── content-library.json    # 60 caption templates
│   └── music/
│       └── tracks.json         # Music manifest
├── package.json
├── nestify.json
└── deploy.sh
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/generate` | Generate new batch |
| `GET /api/videos` | List videos |
| `GET /api/videos/:id/download` | Download video |
| `GET /api/stats` | Dashboard stats |

## Content Categories

1. Meet KiarosX
2. AI Automation Tips
3. Custom Software Solutions
4. Web Development Fast
5. Mobile App Development
6. Business Process Optimization
7. Tech Trends/Insights
8. Client Success Stories
9. Behind the Scenes
10. Call to Action

## Credits

- **Brand:** TDS E Solutions (tdsesolutions.com)
- **Avatar:** KiarosX Control Core v1
- **Built with:** 7 parallel AI agents
