# TDS Content Factory - Backend API

Express.js server for video generation and management.

## Installation

```bash
cd tds-content-factory-v2/server
npm install
```

## Environment Variables

```bash
PORT=3000                    # Server port (default: 3000)
DATA_DIR=/data/videos        # Video storage directory (default: /data/videos)
```

## Running the Server

```bash
# Production
npm start

# Development with auto-reload
npm run dev
```

## API Endpoints

### POST /api/generate
Generate new video batch.

**Request Body:**
```json
{
  "count": 5,
  "topics": ["technology", "business"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generated 5 videos",
  "videos": [...]
}
```

### GET /api/videos
List all videos with optional filters.

**Query Parameters:**
- `date` - Filter by date (YYYY-MM-DD)
- `status` - Filter by status (ready, processing, error)
- `downloaded` - Filter by download status (true/false)
- `limit` - Number of results (default: 100)
- `offset` - Pagination offset (default: 0)

### GET /api/videos/:id/download
Download specific video file.

### POST /api/videos/:id/mark-downloaded
Mark video as downloaded.

### GET /api/stats
Dashboard statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "today": { "generated": 5, "downloaded": 2, "pending": 3 },
    "total": { "generated": 50, "downloaded": 30, "pending": 20 },
    "streak": 7,
    "recentActivity": { "last7Days": 15, "lastGenerated": "..." }
  }
}
```

### GET /api/health
Health check endpoint.

## Cron Job

Daily automatic video generation at 6:00 AM UTC:
- Generates 5-10 videos randomly
- Uses default topics array

## Data Storage

- Videos stored in `/data/videos/` directory
- JSON manifest at `/data/videos/manifest.json`
- Each video entry contains metadata (id, topic, status, dates, etc.)
