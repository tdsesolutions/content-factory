/**
 * Video Generator for TDS Content Factory
 * Uses Playwright to run browser-based canvas rendering with MediaRecorder
 * Generates TikTok-style 9:16 videos (1080x1920)
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
    duration: 10000, // 10 seconds
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
    duration: 10000,
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
    duration: 10000,
    textAnimation: 'typewriter'
  }
];

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
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
    console.error('Error reading manifest:', err);
    return { videos: [], stats: { totalGenerated: 0, totalDownloaded: 0, generationHistory: [] } };
  }
}

/**
 * Write manifest
 */
async function writeManifest(manifest) {
  try {
    await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  } catch (err) {
    console.error('Error writing manifest:', err);
    throw err;
  }
}

/**
 * Generate video using Playwright and Canvas API
 */
async function generateVideo(videoConfig, browser) {
  const { id, title, caption, background, duration, textAnimation } = videoConfig;
  
  console.log(`[Generate] Creating video: ${title}`);
  
  // Create a new page
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 }
  });
  const page = await context.newPage();

  // Create the video using Canvas and MediaRecorder
  const videoBuffer = await page.evaluate(async (config) => {
    const { caption, background, duration, textAnimation } = config;
    
    return new Promise(async (resolve, reject) => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        
        // Setup MediaRecorder
        const stream = canvas.captureStream(30); // 30 FPS
        
        // Create audio context for TTS
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        
        // Add audio track to stream
        stream.addTrack(destination.stream.getAudioTracks()[0]);
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 5000000
        });
        
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              buffer: Array.from(new Uint8Array(reader.result)),
              type: 'video/webm'
            });
          };
          reader.readAsArrayBuffer(blob);
        };
        
        // Animation state
        let startTime = null;
        let animationId = null;
        const words = caption.split(' ');
        const textSpeed = duration / words.length; // ms per word
        
        // Draw functions
        function drawBackground(elapsed) {
          if (background.type === 'gradient') {
            const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
            gradient.addColorStop(0, background.colors[0]);
            gradient.addColorStop(1, background.colors[1]);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1080, 1920);
          } else if (background.type === 'dark-pattern') {
            // Dark background with subtle pattern
            ctx.fillStyle = '#0f0f1a';
            ctx.fillRect(0, 0, 1080, 1920);
            
            // Draw geometric pattern
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 2;
            const time = elapsed / 1000;
            
            for (let i = 0; i < 10; i++) {
              const y = (i * 200 + time * 50) % 2200 - 100;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(1080, y + 100);
              ctx.stroke();
            }
          } else if (background.type === 'tech-grid') {
            // Dark tech grid background
            ctx.fillStyle = '#0a0a12';
            ctx.fillRect(0, 0, 1080, 1920);
            
            // Draw grid
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
            ctx.lineWidth = 1;
            const gridSize = 60;
            const time = elapsed / 1000;
            
            // Vertical lines
            for (let x = 0; x <= 1080; x += gridSize) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, 1920);
              ctx.stroke();
            }
            
            // Horizontal lines with animation
            for (let y = 0; y <= 1920; y += gridSize) {
              const offset = (y + time * 30) % 1920;
              ctx.beginPath();
              ctx.moveTo(0, offset);
              ctx.lineTo(1080, offset);
              ctx.stroke();
            }
          }
        }
        
        function drawAvatar(elapsed) {
          const x = 980; // Right side
          const y = 40;  // Top
          const size = 80;
          
          // Avatar circle background
          ctx.save();
          ctx.beginPath();
          ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
          ctx.clip();
          
          // Avatar gradient background
          const grad = ctx.createLinearGradient(x, y, x, y + size);
          grad.addColorStop(0, '#4a90d9');
          grad.addColorStop(1, '#2c5aa0');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, size, size);
          
          // Face - eyes
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x + size * 0.35, y + size * 0.35, size * 0.1, 0, Math.PI * 2);
          ctx.arc(x + size * 0.65, y + size * 0.35, size * 0.1, 0, Math.PI * 2);
          ctx.fill();
          
          // Animated mouth (talking)
          const talkPhase = Math.sin(elapsed / 100) * 0.5 + 0.5;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(
            x + size * 0.5,
            y + size * 0.65,
            size * 0.15,
            size * 0.08 * talkPhase,
            0, 0, Math.PI * 2
          );
          ctx.fill();
          
          ctx.restore();
          
          // Speech indicator ring
          ctx.strokeStyle = '#4a90d9';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x + size/2, y + size/2, size/2 + 4 + Math.sin(elapsed / 200) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        function wrapText(text, maxWidth) {
          const words = text.split(' ');
          const lines = [];
          let currentLine = words[0];
          
          ctx.font = 'bold 48px Arial';
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
        
        function drawCaption(elapsed) {
          const maxWidth = 1000;
          const x = 540; // Center
          const y = 1400; // Bottom area
          const lineHeight = 70;
          
          // Calculate visible text based on typewriter animation
          let visibleText = caption;
          if (textAnimation === 'typewriter') {
            const wordsToShow = Math.floor(elapsed / textSpeed) + 3; // Start with a few words
            visibleText = words.slice(0, wordsToShow).join(' ');
          }
          
          const lines = wrapText(visibleText, maxWidth);
          
          // Draw text shadow/outline
          ctx.font = 'bold 48px Arial';
          ctx.textAlign = 'center';
          ctx.lineWidth = 8;
          ctx.strokeStyle = '#000000';
          
          lines.forEach((line, i) => {
            ctx.strokeText(line, x, y + i * lineHeight);
          });
          
          // Draw text
          ctx.fillStyle = '#ffffff';
          lines.forEach((line, i) => {
            ctx.fillText(line, x, y + i * lineHeight);
          });
        }
        
        function drawFrame(timestamp) {
          if (!startTime) startTime = timestamp;
          const elapsed = timestamp - startTime;
          
          if (elapsed >= duration) {
            mediaRecorder.stop();
            return;
          }
          
          // Clear and draw
          ctx.clearRect(0, 0, 1080, 1920);
          drawBackground(elapsed);
          drawCaption(elapsed);
          drawAvatar(elapsed);
          
          animationId = requestAnimationFrame(drawFrame);
        }
        
        // Start recording
        mediaRecorder.start(100);
        animationId = requestAnimationFrame(drawFrame);
        
        // TTS simulation (in real implementation, use Web Speech API)
        // For now, we just animate the avatar
        
      } catch (error) {
        reject(error);
      }
    });
  }, { caption, background, duration, textAnimation });

  await context.close();
  
  // Convert buffer back to Node.js Buffer
  const buffer = Buffer.from(videoBuffer.buffer);
  
  // Save file
  const filename = `${id}.webm`;
  const filepath = path.join(DATA_DIR, filename);
  await fs.writeFile(filepath, buffer);
  
  console.log(`[Generate] Saved video: ${filepath} (${buffer.length} bytes)`);
  
  return {
    id,
    title,
    filename,
    filepath,
    topic: title.toLowerCase().replace(/\s+/g, '-'),
    status: 'ready',
    createdAt: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    downloaded: false,
    fileSize: buffer.length,
    duration: duration / 1000
  };
}

/**
 * Generate all sample videos
 */
async function generateSampleVideos() {
  console.log('='.repeat(60));
  console.log('TDS Content Factory - Sample Video Generator');
  console.log('='.repeat(60));
  
  // Ensure directories and manifest
  await ensureDataDir();
  await initializeManifest();
  
  // Launch browser
  console.log('\n[Setup] Launching headless browser...');
  const browser = await chromium.launch({
    headless: true
  });
  
  const manifest = await readManifest();
  const generatedVideos = [];
  
  try {
    // Generate each sample video
    for (const config of SAMPLE_VIDEOS) {
      console.log(`\n[${config.id}] Processing...`);
      
      // Check if video already exists
      const existingIndex = manifest.videos.findIndex(v => v.id === config.id);
      if (existingIndex !== -1) {
        console.log(`  Video ${config.id} already exists, replacing...`);
        manifest.videos.splice(existingIndex, 1);
      }
      
      // Generate video
      const video = await generateVideo(config, browser);
      generatedVideos.push(video);
      manifest.videos.push(video);
      manifest.stats.totalGenerated++;
      
      console.log(`  ✓ Generated: ${video.filename} (${(video.fileSize / 1024).toFixed(1)} KB)`);
    }
    
    // Update manifest
    manifest.stats.generationHistory.push({
      date: new Date().toISOString(),
      count: generatedVideos.length,
      type: 'sample-generation'
    });
    
    await writeManifest(manifest);
    
    console.log('\n' + '='.repeat(60));
    console.log('Generation Complete!');
    console.log('='.repeat(60));
    console.log(`\nGenerated ${generatedVideos.length} sample videos:`);
    generatedVideos.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.title} (${v.duration}s)`);
      console.log(`     File: ${v.filename}`);
    });
    console.log(`\nFiles saved to: ${DATA_DIR}`);
    console.log(`Manifest updated: ${MANIFEST_FILE}`);
    
  } catch (error) {
    console.error('\n[Error] Video generation failed:', error);
    throw error;
  } finally {
    await browser.close();
    console.log('\n[Cleanup] Browser closed');
  }
  
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
