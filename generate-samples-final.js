/**
 * Video Generator using fluent-ffmpeg
 * Generates TikTok-style 9:16 videos (1080x1920) as MP4
 */

const ffmpeg = require('fluent-ffmpeg');
const { createCanvas } = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Set ffmpeg path
const FFMPEG_PATH = path.join(__dirname, 'bin', 'ffmpeg');
ffmpeg.setFfmpegPath(FFMPEG_PATH);

const DATA_DIR = path.join(__dirname, 'data/videos');
const MANIFEST_FILE = path.join(DATA_DIR, 'manifest.json');

// Sample video configurations
const SAMPLE_VIDEOS = [
  {
    id: 'sample-001',
    title: 'Meet KiarosX',
    caption: 'Meet KiarosX 🤖 Your AI content assistant. TDS E Solutions builds cutting-edge automation, custom software, and mobile apps. Let\'s grow your business together.',
    background: {
      type: 'gradient',
      colors: ['#4f46e5', '#06b6d4'] // Indigo to cyan
    },
    music: 'upbeat-tech',
    duration: 10, // 10 seconds
    textAnimation: 'typewriter'
  },
  {
    id: 'sample-002',
    title: 'AI Automation Tips',
    caption: 'Stop doing tasks a robot could handle! 🚀 AI automation saves 10+ hours per week. Email responses, data entry, scheduling - all automated. Work smarter.',
    background: {
      type: 'dark-pattern',
      pattern: 'geometric'
    },
    music: 'corporate-focus',
    duration: 10,
    textAnimation: 'typewriter'
  },
  {
    id: 'sample-003',
    title: 'Custom Software',
    caption: 'Off-the-shelf software not cutting it? 🛠️ We build custom solutions tailored to YOUR exact workflow. No compromises, just results.',
    background: {
      type: 'tech-grid'
    },
    music: 'minimal-tech',
    duration: 10,
    textAnimation: 'typewriter'
  }
];

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Initialize manifest file
 */
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

/**
 * Read manifest
 */
async function readManifest() {
  try {
    const data = await fs.readFile(MANIFEST_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { videos: [], stats: { totalGenerated: 0, totalDownloaded: 0, generationHistory: [] } };
  }
}

/**
 * Write manifest
 */
async function writeManifest(manifest) {
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

/**
 * Wrap text into lines
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];
  
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Draw background
 */
function drawBackground(ctx, width, height, background, progress) {
  if (background.type === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, background.colors[0]);
    gradient.addColorStop(1, background.colors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (background.type === 'dark-pattern') {
    // Dark background
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw geometric pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    
    // Animated lines
    for (let i = 0; i < 15; i++) {
      const y = ((i * 140 + progress * 200) % (height + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + 80);
      ctx.stroke();
    }
    
    // Add geometric shapes
    ctx.strokeStyle = 'rgba(79, 70, 229, 0.1)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = (i * 250 + 100) % width;
      const y = (i * 350 + 200) % height;
      const size = 50 + Math.sin(progress * Math.PI * 2 + i) * 20;
      ctx.strokeRect(x - size/2, y - size/2, size, size);
    }
  } else if (background.type === 'tech-grid') {
    // Dark tech grid
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Horizontal lines with animation
    for (let y = 0; y <= height; y += gridSize) {
      const offset = (y + progress * gridSize) % height;
      ctx.beginPath();
      ctx.moveTo(0, offset);
      ctx.lineTo(width, offset);
      ctx.stroke();
    }
    
    // Glowing nodes at intersections
    ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
    for (let x = gridSize; x < width; x += gridSize * 3) {
      for (let y = gridSize; y < height; y += gridSize * 3) {
        const pulse = Math.sin(progress * Math.PI * 4 + x * 0.01 + y * 0.01) * 0.5 + 0.5;
        ctx.globalAlpha = 0.2 + pulse * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, 4 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  }
}

/**
 * Draw avatar
 */
function drawAvatar(ctx, x, y, size, frameNum) {
  ctx.save();
  
  // Avatar circle clip
  ctx.beginPath();
  ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
  ctx.clip();
  
  // Avatar gradient background
  const grad = ctx.createLinearGradient(x, y, x, y + size);
  grad.addColorStop(0, '#4a90d9');
  grad.addColorStop(1, '#2c5aa0');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, size, size);
  
  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + size * 0.35, y + size * 0.35, size * 0.1, 0, Math.PI * 2);
  ctx.arc(x + size * 0.65, y + size * 0.35, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  
  // Animated mouth (talking)
  const talkPhase = Math.sin(frameNum * 0.3) * 0.5 + 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(
    x + size * 0.5,
    y + size * 0.65,
    size * 0.15,
    size * 0.08 * talkPhase + 2,
    0, 0, Math.PI * 2
  );
  ctx.fill();
  
  ctx.restore();
  
  // Speech indicator ring with pulse
  const pulseSize = Math.sin(frameNum * 0.15) * 3;
  ctx.strokeStyle = '#4a90d9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + size/2, y + size/2, size/2 + 5 + pulseSize, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draw caption with typewriter effect
 */
function drawCaption(ctx, caption, frameNum, totalFrames, width, height) {
  const maxWidth = 950;
  const x = width / 2;
  const y = height - 350;
  const lineHeight = 70;
  
  // Calculate visible text (typewriter effect)
  const words = caption.split(' ');
  const wordsPerFrame = words.length / totalFrames;
  const visibleWordCount = Math.min(
    Math.floor(frameNum * wordsPerFrame) + 3,
    words.length
  );
  const visibleText = words.slice(0, visibleWordCount).join(' ');
  
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.textAlign = 'center';
  
  const lines = wrapText(ctx, visibleText, maxWidth);
  
  // Draw text shadow/outline
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  
  lines.forEach((line, i) => {
    ctx.strokeText(line, x, y + i * lineHeight);
  });
  
  // Draw text
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineHeight);
  });
}

/**
 * Generate a video
 */
async function generateVideo(videoConfig) {
  const { id, title, caption, background, duration } = videoConfig;
  
  console.log(`[Generate] Creating video: ${title}`);
  
  const width = 1080;
  const height = 1920;
  const fps = 30;
  const totalFrames = duration * fps;
  
  // Create temp directory for frames
  const tempDir = path.join(DATA_DIR, `temp-${id}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Generate and save frames
  console.log(`  Generating ${totalFrames} frames...`);
  
  for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background
    const progress = frameNum / totalFrames;
    drawBackground(ctx, width, height, background, progress);
    
    // Draw caption
    drawCaption(ctx, caption, frameNum, totalFrames, width, height);
    
    // Draw avatar (top right)
    drawAvatar(ctx, width - 120, 40, 80, frameNum);
    
    // Save frame as JPEG for smaller file size
    const framePath = path.join(tempDir, `frame_${String(frameNum).padStart(5, '0')}.jpg`);
    const frameBuffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    await fs.writeFile(framePath, frameBuffer);
    
    // Progress
    if (frameNum % 30 === 0) {
      const percent = ((frameNum / totalFrames) * 100).toFixed(0);
      process.stdout.write(`\r  Frames: ${percent}%`);
    }
  }
  console.log('\r  Frames: 100%');
  
  // Encode to MP4 using ffmpeg directly
  console.log('  Encoding to MP4...');
  
  const outputFilename = `${id}.mp4`;
  const outputPath = path.join(DATA_DIR, outputFilename);
  const inputPattern = path.join(tempDir, 'frame_%05d.jpg');
  
  await new Promise((resolve, reject) => {
    const ffmpegCmd = spawn(FFMPEG_PATH, [
      '-framerate', String(fps),
      '-i', inputPattern,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '23',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ]);
    
    let stderr = '';
    ffmpegCmd.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpegCmd.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });
    
    ffmpegCmd.on('error', reject);
  });
  
  // Cleanup temp files
  console.log('  Cleaning up...');
  const tempFiles = await fs.readdir(tempDir);
  for (const file of tempFiles) {
    await fs.unlink(path.join(tempDir, file));
  }
  await fs.rmdir(tempDir);
  
  // Get file stats
  const stats = await fs.stat(outputPath);
  
  console.log(`  ✓ Saved: ${outputFilename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  
  return {
    id,
    title,
    filename: outputFilename,
    filepath: outputPath,
    topic: title.toLowerCase().replace(/\s+/g, '-'),
    status: 'ready',
    createdAt: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    downloaded: false,
    fileSize: stats.size,
    duration,
    width,
    height,
    fps
  };
}

/**
 * Generate all sample videos
 */
async function generateSampleVideos() {
  console.log('='.repeat(60));
  console.log('TDS Content Factory - Sample Video Generator');
  console.log('Using FFmpeg for MP4 encoding');
  console.log('='.repeat(60));
  
  await ensureDataDir();
  await initializeManifest();
  
  const manifest = await readManifest();
  const generatedVideos = [];
  
  for (const config of SAMPLE_VIDEOS) {
    console.log(`\n[${config.id}] Processing...`);
    
    // Check if video already exists
    const existingIndex = manifest.videos.findIndex(v => v.id === config.id);
    if (existingIndex !== -1) {
      console.log(`  Video ${config.id} already exists, replacing...`);
      manifest.videos.splice(existingIndex, 1);
      
      // Delete old file
      const oldFilename = manifest.videos[existingIndex]?.filename;
      if (oldFilename) {
        try {
          await fs.unlink(path.join(DATA_DIR, oldFilename));
        } catch {}
      }
    }
    
    try {
      const video = await generateVideo(config);
      generatedVideos.push(video);
      manifest.videos.push(video);
      manifest.stats.totalGenerated++;
    } catch (err) {
      console.error(`  ✗ Failed:`, err.message);
    }
  }
  
  // Update manifest
  if (generatedVideos.length > 0) {
    manifest.stats.generationHistory.push({
      date: new Date().toISOString(),
      count: generatedVideos.length,
      type: 'sample-generation'
    });
    
    await writeManifest(manifest);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Generation Complete!');
  console.log('='.repeat(60));
  console.log(`\nGenerated ${generatedVideos.length} sample videos:`);
  generatedVideos.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.title} (${v.duration}s) - ${v.filename} (${(v.fileSize / 1024 / 1024).toFixed(2)} MB)`);
  });
  console.log(`\nFiles saved to: ${DATA_DIR}`);
  console.log(`Manifest: ${MANIFEST_FILE}`);
  
  return generatedVideos;
}

// Run if called directly
if (require.main === module) {
  generateSampleVideos()
    .then(() => {
      console.log('\n✓ Done!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n✗ Failed:', err);
      process.exit(1);
    });
}

module.exports = { generateSampleVideos, generateVideo };
