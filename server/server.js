/**
 * TDS Content Factory - Backend API Server
 * 
 * Express.js server for video generation and management
 * Features:
 * - Video generation endpoints
 * - Video listing with filters
 * - Video download
 * - Dashboard stats
 * - Daily cron job for auto-generation
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data/videos';
const MANIFEST_FILE = path.join(DATA_DIR, 'manifest.json');

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
}

// Initialize manifest if it doesn't exist
async function initializeManifest() {
  try {
    await fs.access(MANIFEST_FILE);
  } catch {
    const initialManifest = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      videos: [],
      stats: {
        totalGenerated: 0,
        totalDownloaded: 0,
        generationHistory: []
      }
    };
    await fs.writeFile(MANIFEST_FILE, JSON.stringify(initialManifest, null, 2));
  }
}

// Read manifest
async function readManifest() {
  try {
    const data = await fs.readFile(MANIFEST_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading manifest:', err);
    return { videos: [], stats: { totalGenerated: 0, totalDownloaded: 0, generationHistory: [] } };
  }
}

// Write manifest
async function writeManifest(manifest) {
  try {
    await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  } catch (err) {
    console.error('Error writing manifest:', err);
    throw err;
  }
}

// Simulate video generation (placeholder for actual generation logic)
async function generateVideo(topics) {
  const id = uuidv4();
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().split('T')[0];
  const filename = `video_${id}.mp4`;
  const filePath = path.join(DATA_DIR, filename);
  
  // Select a random topic if multiple provided
  const topic = Array.isArray(topics) && topics.length > 0 
    ? topics[Math.floor(Math.random() * topics.length)]
    : 'general';
  
  // Create placeholder video file (in real implementation, this would be actual video generation)
  const placeholderContent = `TDS Video Content - Topic: ${topic} - Generated: ${timestamp.toISOString()}`;
  await fs.writeFile(filePath, placeholderContent);
  
  return {
    id,
    filename,
    topic,
    status: 'ready',
    createdAt: timestamp.toISOString(),
    date: dateStr,
    downloaded: false,
    downloadedAt: null,
    fileSize: Buffer.byteLength(placeholderContent)
  };
}

// Generate batch of videos
async function generateVideoBatch(count, topics) {
  const videos = [];
  const manifest = await readManifest();
  
  for (let i = 0; i < count; i++) {
    try {
      const video = await generateVideo(topics);
      videos.push(video);
      manifest.videos.push(video);
      manifest.stats.totalGenerated++;
    } catch (err) {
      console.error(`Error generating video ${i + 1}:`, err);
    }
  }
  
  // Record generation history
  manifest.stats.generationHistory.push({
    date: new Date().toISOString(),
    count: videos.length,
    topics: topics || ['general']
  });
  
  await writeManifest(manifest);
  return videos;
}

// Get today's date string
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

// Calculate streak
function calculateStreak(history) {
  if (!history || history.length === 0) return 0;
  
  const sortedHistory = history
    .map(h => h.date.split('T')[0])
    .filter((v, i, a) => a.indexOf(v) === i) // unique dates only
    .sort((a, b) => new Date(b) - new Date(a));
  
  if (sortedHistory.length === 0) return 0;
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const dateStr of sortedHistory) {
    const historyDate = new Date(dateStr);
    historyDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((currentDate - historyDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === streak) {
      streak++;
    } else if (diffDays > streak) {
      break;
    }
  }
  
  return streak;
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /api/generate
 * Generate new video batch
 * Body: { count: number, topics: string[] }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { count = 1, topics = [] } = req.body;
    
    // Validate count
    const videoCount = Math.min(Math.max(parseInt(count) || 1, 1), 20);
    
    console.log(`[Generate] Creating ${videoCount} videos with topics:`, topics);
    
    const videos = await generateVideoBatch(videoCount, topics);
    
    res.json({
      success: true,
      message: `Generated ${videos.length} videos`,
      videos: videos.map(v => ({
        id: v.id,
        topic: v.topic,
        status: v.status,
        createdAt: v.createdAt
      }))
    });
  } catch (err) {
    console.error('Error in /api/generate:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate videos',
      message: err.message
    });
  }
});

/**
 * GET /api/videos
 * List all videos with optional filters
 * Query: { date?: string, status?: string, downloaded?: boolean }
 */
app.get('/api/videos', async (req, res) => {
  try {
    const { date, status, downloaded, limit = 100, offset = 0 } = req.query;
    
    const manifest = await readManifest();
    let videos = manifest.videos;
    
    // Apply filters
    if (date) {
      videos = videos.filter(v => v.date === date);
    }
    
    if (status) {
      videos = videos.filter(v => v.status === status);
    }
    
    if (downloaded !== undefined) {
      const isDownloaded = downloaded === 'true';
      videos = videos.filter(v => v.downloaded === isDownloaded);
    }
    
    // Sort by creation date (newest first)
    videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const total = videos.length;
    const startIndex = parseInt(offset) || 0;
    const endIndex = startIndex + (parseInt(limit) || 100);
    const paginatedVideos = videos.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      total,
      offset: startIndex,
      limit: parseInt(limit) || 100,
      videos: paginatedVideos.map(v => ({
        id: v.id,
        filename: v.filename,
        topic: v.topic,
        status: v.status,
        createdAt: v.createdAt,
        date: v.date,
        downloaded: v.downloaded,
        downloadedAt: v.downloadedAt,
        fileSize: v.fileSize
      }))
    });
  } catch (err) {
    console.error('Error in /api/videos:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch videos',
      message: err.message
    });
  }
});

/**
 * GET /api/videos/:id/download
 * Download specific video
 */
app.get('/api/videos/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    
    const manifest = await readManifest();
    const video = manifest.videos.find(v => v.id === id);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    const filePath = path.join(DATA_DIR, video.filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Video file not found on disk'
      });
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${video.filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    res.sendFile(filePath);
    
  } catch (err) {
    console.error('Error in /api/videos/:id/download:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to download video',
      message: err.message
    });
  }
});

/**
 * POST /api/videos/:id/mark-downloaded
 * Mark video as downloaded
 */
app.post('/api/videos/:id/mark-downloaded', async (req, res) => {
  try {
    const { id } = req.params;
    
    const manifest = await readManifest();
    const videoIndex = manifest.videos.findIndex(v => v.id === id);
    
    if (videoIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }
    
    // Mark as downloaded
    manifest.videos[videoIndex].downloaded = true;
    manifest.videos[videoIndex].downloadedAt = new Date().toISOString();
    
    // Increment total downloaded counter if not already counted
    if (!manifest.videos[videoIndex].wasCounted) {
      manifest.stats.totalDownloaded++;
      manifest.videos[videoIndex].wasCounted = true;
    }
    
    await writeManifest(manifest);
    
    res.json({
      success: true,
      message: 'Video marked as downloaded',
      video: {
        id: manifest.videos[videoIndex].id,
        downloaded: true,
        downloadedAt: manifest.videos[videoIndex].downloadedAt
      }
    });
  } catch (err) {
    console.error('Error in /api/videos/:id/mark-downloaded:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to mark video as downloaded',
      message: err.message
    });
  }
});

/**
 * GET /api/stats
 * Dashboard stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const manifest = await readManifest();
    const today = getTodayString();
    
    // Calculate stats
    const todayVideos = manifest.videos.filter(v => v.date === today);
    const todayCount = todayVideos.length;
    const todayDownloaded = todayVideos.filter(v => v.downloaded).length;
    
    const totalCount = manifest.videos.length;
    const totalDownloaded = manifest.stats.totalDownloaded;
    const streak = calculateStreak(manifest.stats.generationHistory);
    
    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentVideos = manifest.videos.filter(v => 
      new Date(v.createdAt) >= sevenDaysAgo
    );
    
    res.json({
      success: true,
      stats: {
        today: {
          generated: todayCount,
          downloaded: todayDownloaded,
          pending: todayCount - todayDownloaded
        },
        total: {
          generated: totalCount,
          downloaded: totalDownloaded,
          pending: totalCount - totalDownloaded
        },
        streak,
        recentActivity: {
          last7Days: recentVideos.length,
          lastGenerated: manifest.videos.length > 0 
            ? manifest.videos[manifest.videos.length - 1].createdAt 
            : null
        }
      }
    });
  } catch (err) {
    console.error('Error in /api/stats:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: err.message
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// ============================================
// CRON JOB - Daily auto-generation at 6 AM
// ============================================

// Schedule: Every day at 6:00 AM
cron.schedule('0 6 * * *', async () => {
  console.log('[Cron] Starting daily video generation at 6:00 AM...');
  
  try {
    // Random count between 5 and 10
    const count = Math.floor(Math.random() * 6) + 5;
    
    // Default topics for auto-generation
    const topics = [
      'technology',
      'business',
      'lifestyle',
      'education',
      'entertainment'
    ];
    
    console.log(`[Cron] Generating ${count} videos...`);
    const videos = await generateVideoBatch(count, topics);
    console.log(`[Cron] Successfully generated ${videos.length} videos`);
    
    // Log the generation
    const manifest = await readManifest();
    manifest.stats.generationHistory.push({
      date: new Date().toISOString(),
      count: videos.length,
      topics,
      type: 'auto-cron'
    });
    await writeManifest(manifest);
    
  } catch (err) {
    console.error('[Cron] Error during auto-generation:', err);
  }
}, {
  scheduled: true,
  timezone: 'UTC'
});

console.log('[Cron] Scheduled daily video generation for 6:00 AM UTC');

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  await ensureDataDir();
  await initializeManifest();
  
  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('TDS Content Factory API Server');
    console.log('='.repeat(50));
    console.log(`Server running on port: ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
    console.log(`Manifest file: ${MANIFEST_FILE}`);
    console.log('-'.repeat(50));
    console.log('Available endpoints:');
    console.log('  POST /api/generate');
    console.log('  GET  /api/videos');
    console.log('  GET  /api/videos/:id/download');
    console.log('  POST /api/videos/:id/mark-downloaded');
    console.log('  GET  /api/stats');
    console.log('  GET  /api/health');
    console.log('='.repeat(50));
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
