/**
 * Video Renderer & Composer
 * Composes 9:16 TikTok videos (1080x1920) with background, text overlays, avatar, and audio
 * Uses Canvas 2D, MediaRecorder API, and Web Audio API
 */

class VideoRenderer {
  constructor(options = {}) {
    this.canvas = null;
    this.ctx = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.audioContext = null;
    this.destinationNode = null;
    this.mediaStreamDestination = null;
    this.isRecording = false;
    
    // Canvas settings
    this.width = options.width || 1080;
    this.height = options.height || 1920;
    this.fps = options.fps || 30;
    
    // Elements
    this.avatar = null;
    this.background = null;
    this.caption = '';
    this.musicTrack = null;
    
    // Animation state
    this.currentFrame = 0;
    this.animationId = null;
    this.startTime = 0;
    
    // Text animation settings
    this.textAnimation = options.textAnimation || 'typewriter'; // 'typewriter' or 'fade'
    this.textSpeed = options.textSpeed || 50; // ms per word for typewriter
    this.fadeDuration = options.fadeDuration || 500; // ms for fade
    
    // Avatar settings
    this.avatarSize = options.avatarSize || 80;
    this.avatarPosition = options.avatarPosition || { x: this.width - 100, y: 40 };
    
    // Callbacks
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
  }

  /**
   * Initialize the canvas and audio context
   */
  async initialize() {
    // Create offscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');
    
    // Initialize Web Audio API
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create media stream destination for audio recording
    this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
    
    return this;
  }

  /**
   * Set background (video, image, or color)
   * @param {string|HTMLVideoElement|HTMLImageElement} background - URL or element
   * @param {string} type - 'video', 'image', or 'color'
   */
  async setBackground(background, type = 'color') {
    if (type === 'color' || type === 'gradient') {
      this.background = { type, value: background };
    } else if (type === 'video') {
      const video = await this.loadVideo(background);
      video.loop = true;
      video.muted = true;
      this.background = { type: 'video', element: video };
    } else if (type === 'image') {
      const image = await this.loadImage(background);
      this.background = { type: 'image', element: image };
    }
    return this;
  }

  /**
   * Set the avatar instance
   * @param {Object} avatar - Avatar instance with render method
   */
  setAvatar(avatar) {
    this.avatar = avatar;
    return this;
  }

  /**
   * Set caption text
   * @param {string} text - Caption text
   * @param {Object} styles - Text styles (font, color, etc.)
   */
  setCaption(text, styles = {}) {
    this.caption = text;
    this.captionStyles = {
      font: styles.font || 'bold 48px Arial',
      color: styles.color || '#ffffff',
      strokeColor: styles.strokeColor || '#000000',
      strokeWidth: styles.strokeWidth || 4,
      lineHeight: styles.lineHeight || 60,
      maxWidth: styles.maxWidth || this.width - 80,
      textAlign: styles.textAlign || 'center',
      x: styles.x || this.width / 2,
      y: styles.y || this.height - 200,
      ...styles
    };
    return this;
  }

  /**
   * Set background music
   * @param {string|HTMLAudioElement} track - URL or audio element
   */
  async setMusic(track) {
    if (typeof track === 'string') {
      this.musicTrack = await this.loadAudio(track);
    } else {
      this.musicTrack = track;
    }
    return this;
  }

  /**
   * Load video from URL
   * @param {string} url - Video URL
   * @returns {Promise<HTMLVideoElement>}
   */
  loadVideo(url) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = url;
      video.onloadeddata = () => resolve(video);
      video.onerror = reject;
    });
  }

  /**
   * Load image from URL
   * @param {string} url - Image URL
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  }

  /**
   * Load audio from URL
   * @param {string} url - Audio URL
   * @returns {Promise<HTMLAudioElement>}
   */
  loadAudio(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = url;
      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = reject;
    });
  }

  /**
   * Text-to-Speech with Web Speech API
   * @param {string} text - Text to speak
   * @param {Object} options - TTS options
   * @returns {Promise<{blob: Blob, duration: number}>}
   */
  async textToSpeech(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Web Speech API not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;
      
      // Try to find a neutral voice
      const voices = window.speechSynthesis.getVoices();
      const neutralVoice = voices.find(v => v.lang.includes('en')) || voices[0];
      if (neutralVoice) {
        utterance.voice = neutralVoice;
      }

      // Estimate duration based on text length and rate
      const estimatedDuration = (text.length / 15) * 1000 / utterance.rate;

      // Track when speaking starts/stops
      let speakingStarted = false;
      
      utterance.onstart = () => {
        speakingStarted = true;
        if (this.avatar) {
          this.avatar.setTalking(true);
        }
      };

      utterance.onend = () => {
        if (this.avatar) {
          this.avatar.setTalking(false);
        }
      };

      utterance.onerror = (e) => reject(e);

      // Speak the text
      window.speechSynthesis.speak(utterance);

      // Create a silent audio buffer (actual capture requires more complex setup)
      // In production, use Web Audio API to capture system audio
      resolve({
        utterance,
        duration: estimatedDuration,
        speakingStarted
      });
    });
  }

  /**
   * Create audio source from element and connect to destination
   * @param {HTMLAudioElement|HTMLVideoElement} element
   * @param {number} volume - Volume (0-1)
   * @returns {MediaElementAudioSourceNode}
   */
  createAudioSource(element, volume = 1.0) {
    const source = this.audioContext.createMediaElementSource(element);
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(this.mediaStreamDestination);
    gainNode.connect(this.audioContext.destination);
    
    return { source, gainNode };
  }

  /**
   * Draw background on canvas
   */
  drawBackground() {
    if (!this.background) {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    if (this.background.type === 'color') {
      this.ctx.fillStyle = this.background.value;
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.background.type === 'gradient') {
      const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
      if (Array.isArray(this.background.value)) {
        this.background.value.forEach((color, i) => {
          gradient.addColorStop(i / (this.background.value.length - 1), color);
        });
      }
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else if (this.background.type === 'image' && this.background.element) {
      this.ctx.drawImage(this.background.element, 0, 0, this.width, this.height);
    } else if (this.background.type === 'video' && this.background.element) {
      this.ctx.drawImage(this.background.element, 0, 0, this.width, this.height);
    }
  }

  /**
   * Draw avatar on canvas
   */
  drawAvatar() {
    if (!this.avatar) return;

    const { x, y } = this.avatarPosition;
    const size = this.avatarSize;

    // Save context state
    this.ctx.save();
    
    // Create circular clip for avatar
    this.ctx.beginPath();
    this.ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    this.ctx.clip();

    // Render avatar (avatar should have a render method or we draw a placeholder)
    if (this.avatar.render && typeof this.avatar.render === 'function') {
      this.avatar.render(this.ctx, x, y, size, size);
    } else if (this.avatar.element) {
      this.ctx.drawImage(this.avatar.element, x, y, size, size);
    } else {
      // Draw placeholder avatar
      this.ctx.fillStyle = '#4a90d9';
      this.ctx.fillRect(x, y, size, size);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('AI', x + size / 2, y + size / 2 + 8);
    }

    this.ctx.restore();

    // Draw speech indicator when talking
    if (this.avatar && this.avatar.isTalking) {
      this.ctx.save();
      this.ctx.strokeStyle = '#4a90d9';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(x + size / 2, y + size / 2, size / 2 + 5, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * Draw caption with animation
   * @param {number} elapsedTime - Elapsed time in ms
   */
  drawCaption(elapsedTime) {
    if (!this.caption) return;

    const words = this.caption.split(' ');
    let textToShow = this.caption;

    if (this.textAnimation === 'typewriter') {
      const wordsToShow = Math.floor(elapsedTime / this.textSpeed);
      textToShow = words.slice(0, wordsToShow).join(' ');
    } else if (this.textAnimation === 'fade') {
      const progress = Math.min(elapsedTime / this.fadeDuration, 1);
      this.ctx.globalAlpha = progress;
    }

    const { font, color, strokeColor, strokeWidth, lineHeight, maxWidth, textAlign, x, y } = this.captionStyles;

    this.ctx.font = font;
    this.ctx.textAlign = textAlign;
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = strokeWidth;

    // Word wrap
    const lines = this.wrapText(textToShow, maxWidth);
    
    lines.forEach((line, i) => {
      const lineY = y + i * lineHeight;
      this.ctx.strokeText(line, x, lineY);
      this.ctx.fillText(line, x, lineY);
    });

    if (this.textAnimation === 'fade') {
      this.ctx.globalAlpha = 1.0;
    }
  }

  /**
   * Wrap text into lines
   * @param {string} text - Text to wrap
   * @param {number} maxWidth - Maximum width
   * @returns {string[]} Array of lines
   */
  wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = this.ctx.measureText(currentLine + ' ' + word).width;
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
   * Render a single frame
   * @param {number} elapsedTime - Elapsed time in ms
   */
  renderFrame(elapsedTime) {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw background
    this.drawBackground();

    // 2. Draw main content area (placeholder for additional graphics)
    // This is where you could add images, charts, etc.

    // 3. Draw caption
    this.drawCaption(elapsedTime);

    // 4. Draw avatar (on top)
    this.drawAvatar();
  }

  /**
   * Start the rendering and recording process
   * @param {number} duration - Duration in ms
   * @returns {Promise<Blob>} - Recorded video blob
   */
  async render(duration = 15000) {
    if (!this.canvas) {
      await this.initialize();
    }

    return new Promise(async (resolve, reject) => {
      try {
        // Combine canvas stream with audio stream
        const canvasStream = this.canvas.captureStream(this.fps);
        const audioStream = this.mediaStreamDestination.stream;
        
        // Merge streams
        const combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
        audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

        // Setup MediaRecorder
        const mimeType = this.getSupportedMimeType();
        const options = {
          mimeType,
          videoBitsPerSecond: 5000000 // 5 Mbps
        };

        this.mediaRecorder = new MediaRecorder(combinedStream, options);
        this.recordedChunks = [];

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: mimeType });
          this.isRecording = false;
          this.onComplete(blob);
          resolve(blob);
        };

        this.mediaRecorder.onerror = (e) => {
          this.onError(e);
          reject(e);
        };

        // Start recording
        this.mediaRecorder.start(100); // Collect data every 100ms
        this.isRecording = true;
        this.startTime = performance.now();

        // Start background music if set
        if (this.musicTrack) {
          this.musicTrack.currentTime = 0;
          this.musicTrack.volume = 0.3; // Lower volume for background
          this.createAudioSource(this.musicTrack, 0.3);
          this.musicTrack.play().catch(console.error);
        }

        // Start video background if set
        if (this.background && this.background.type === 'video') {
          this.background.element.currentTime = 0;
          this.background.element.play().catch(console.error);
        }

        // Start TTS for caption
        if (this.caption) {
          this.textToSpeech(this.caption).catch(console.error);
        }

        // Animation loop
        const animate = () => {
          const elapsedTime = performance.now() - this.startTime;
          
          if (elapsedTime >= duration) {
            this.stop();
            return;
          }

          this.renderFrame(elapsedTime);
          this.onProgress(elapsedTime / duration);
          
          this.animationId = requestAnimationFrame(animate);
        };

        animate();

      } catch (error) {
        this.onError(error);
        reject(error);
      }
    });
  }

  /**
   * Stop recording
   */
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.musicTrack) {
      this.musicTrack.pause();
    }

    if (this.background && this.background.type === 'video') {
      this.background.element.pause();
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.isRecording = false;
  }

  /**
   * Get supported MIME type for MediaRecorder
   * @returns {string}
   */
  getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm';
  }

  /**
   * Save video blob to server
   * @param {Blob} blob - Video blob
   * @param {string} filename - Filename
   * @param {string} endpoint - Upload endpoint
   * @returns {Promise<Object>} - Server response
   */
  async saveToServer(blob, filename = 'video.webm', endpoint = '/api/upload') {
    const formData = new FormData();
    formData.append('video', blob, filename);
    formData.append('metadata', JSON.stringify({
      width: this.width,
      height: this.height,
      duration: this.duration,
      createdAt: new Date().toISOString()
    }));

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Download video locally
   * @param {Blob} blob - Video blob
   * @param {string} filename - Filename
   */
  download(blob, filename = 'video.webm') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.stop();
    
    if (this.canvas) {
      this.canvas = null;
      this.ctx = null;
    }

    this.recordedChunks = [];
    this.mediaRecorder = null;
  }
}

/**
 * Avatar class for KiarosX
 * Manages avatar state and rendering
 */
class Avatar {
  constructor(options = {}) {
    this.image = options.image || null;
    this.size = options.size || 80;
    this.isTalking = false;
    this.talkingStartTime = 0;
    this.blinkInterval = null;
    this.isBlinking = false;
    this.animationFrame = 0;
  }

  /**
   * Set avatar image
   * @param {string|HTMLImageElement} image - Image source
   */
  async setImage(image) {
    if (typeof image === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = image;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      this.image = img;
    } else {
      this.image = image;
    }
  }

  /**
   * Set talking state
   * @param {boolean} talking - Is avatar talking
   */
  setTalking(talking) {
    this.isTalking = talking;
    if (talking) {
      this.talkingStartTime = performance.now();
    }
  }

  /**
   * Render avatar on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   */
  render(ctx, x, y, width, height) {
    this.animationFrame++;

    if (this.image) {
      ctx.drawImage(this.image, x, y, width, height);
    } else {
      // Draw placeholder avatar
      const gradient = ctx.createLinearGradient(x, y, x, y + height);
      gradient.addColorStop(0, '#4a90d9');
      gradient.addColorStop(1, '#2c5aa0');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);

      // Draw face
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + width * 0.35, y + height * 0.35, width * 0.1, 0, Math.PI * 2);
      ctx.arc(x + width * 0.65, y + height * 0.35, width * 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Draw animated mouth
      ctx.fillStyle = '#ffffff';
      const mouthY = y + height * 0.65;
      const mouthOpen = this.isTalking ? 
        Math.sin(this.animationFrame * 0.2) * 5 + 5 : 0;
      
      ctx.beginPath();
      ctx.ellipse(
        x + width * 0.5,
        mouthY,
        width * 0.15,
        width * 0.05 + mouthOpen,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }
}

/**
 * VideoComposer - High-level API for composing videos
 */
class VideoComposer {
  constructor() {
    this.renderer = new VideoRenderer();
    this.avatar = new Avatar();
  }

  /**
   * Compose a video with all elements
   * @param {Object} config - Video configuration
   * @returns {Promise<Blob>}
   */
  async compose(config) {
    const {
      caption,
      background,
      backgroundType = 'color',
      music,
      duration = 15000,
      textAnimation = 'typewriter',
      avatarImage,
      onProgress,
      onComplete
    } = config;

    // Initialize renderer
    await this.renderer.initialize();

    // Set callbacks
    if (onProgress) this.renderer.onProgress = onProgress;
    if (onComplete) this.renderer.onComplete = onComplete;

    // Set elements
    await this.renderer.setBackground(background, backgroundType);
    
    if (avatarImage) {
      await this.avatar.setImage(avatarImage);
    }
    this.renderer.setAvatar(this.avatar);

    if (caption) {
      this.renderer.setCaption(caption, config.textStyles);
    }

    if (music) {
      await this.renderer.setMusic(music);
    }

    this.renderer.textAnimation = textAnimation;

    // Render video
    return this.renderer.render(duration);
  }

  /**
   * Quick render with minimal config
   * @param {string} caption - Caption text
   * @param {Object} options - Additional options
   * @returns {Promise<Blob>}
   */
  async quickRender(caption, options = {}) {
    return this.compose({
      caption,
      background: options.background || '#1a1a2e',
      backgroundType: options.backgroundType || 'color',
      duration: options.duration || 10000,
      ...options
    });
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VideoRenderer, Avatar, VideoComposer };
} else if (typeof define === 'function' && define.amd) {
  define([], function() {
    return { VideoRenderer, Avatar, VideoComposer };
  });
} else {
  window.VideoRenderer = VideoRenderer;
  window.Avatar = Avatar;
  window.VideoComposer = VideoComposer;
}


// ============================================
// EXAMPLE USAGE CODE
// ============================================

/**
 * Example 1: Basic Usage
 * Compose a simple video with caption and gradient background
 */
async function exampleBasic() {
  const composer = new VideoComposer();
  
  const videoBlob = await composer.compose({
    caption: "Welcome to the future of AI content creation!",
    background: ["#667eea", "#764ba2"], // Gradient colors
    backgroundType: "gradient",
    duration: 8000,
    textAnimation: "typewriter",
    onProgress: (progress) => {
      console.log(`Rendering: ${(progress * 100).toFixed(1)}%`);
    }
  });

  // Download the video
  const renderer = new VideoRenderer();
  renderer.download(videoBlob, "my-video.webm");
}

/**
 * Example 2: Advanced Usage with All Elements
 * Full video with background video, music, and avatar
 */
async function exampleAdvanced() {
  const renderer = new VideoRenderer({
    width: 1080,
    height: 1920,
    fps: 30,
    textAnimation: "fade",
    textSpeed: 80
  });

  await renderer.initialize();

  // Create avatar
  const avatar = new Avatar();
  await avatar.setImage("https://example.com/avatar.png");

  // Setup renderer
  await renderer.setBackground("https://example.com/background-video.mp4", "video");
  renderer.setAvatar(avatar);
  renderer.setCaption(
    "This is an example of advanced video composition with all elements layered together!",
    {
      font: "bold 56px Inter",
      color: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 6,
      y: 1600
    }
  );
  await renderer.setMusic("https://example.com/background-music.mp3");

  // Render
  const videoBlob = await renderer.render(12000);

  // Upload to server
  try {
    const response = await renderer.saveToServer(videoBlob, "video.webm", "/api/videos/upload");
    console.log("Video uploaded:", response);
  } catch (error) {
    console.error("Upload failed:", error);
  }

  renderer.dispose();
}

/**
 * Example 3: Batch Processing
 * Create multiple videos in sequence
 */
async function exampleBatch() {
  const captions = [
    "First video in the batch",
    "Second video with different content",
    "Third video to complete the series"
  ];

  const backgrounds = [
    ["#f093fb", "#f5576c"],
    ["#4facfe", "#00f2fe"],
    ["#43e97b", "#38f9d7"]
  ];

  const composer = new VideoComposer();
  const videos = [];

  for (let i = 0; i < captions.length; i++) {
    console.log(`Rendering video ${i + 1}/${captions.length}...`);
    
    const blob = await composer.compose({
      caption: captions[i],
      background: backgrounds[i],
      backgroundType: "gradient",
      duration: 5000
    });

    videos.push(blob);
    
    // Small delay between renders
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`Rendered ${videos.length} videos`);
  return videos;
}

/**
 * Example 4: Custom Animation Loop
 * Manual control over rendering for custom effects
 */
async function exampleCustomAnimation() {
  const renderer = new VideoRenderer();
  await renderer.initialize();

  renderer.setBackground("#0f0f23", "color");
  renderer.setCaption("Custom animation with particles!");

  // Custom particle system
  const particles = Array.from({ length: 50 }, () => ({
    x: Math.random() * 1080,
    y: Math.random() * 1920,
    size: Math.random() * 4 + 2,
    speedY: Math.random() * 2 + 1,
    opacity: Math.random()
  }));

  // Override renderFrame to add particles
  const originalRenderFrame = renderer.renderFrame.bind(renderer);
  renderer.renderFrame = function(elapsedTime) {
    // Call original rendering
    originalRenderFrame(elapsedTime);

    // Add particle effect
    particles.forEach(p => {
      p.y -= p.speedY;
      if (p.y < 0) {
        p.y = 1920;
        p.x = Math.random() * 1080;
      }

      this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
  };

  const blob = await renderer.render(10000);
  renderer.download(blob, "particles-video.webm");
  renderer.dispose();
}

/**
 * Example 5: Preview Mode (No Recording)
 * Preview the video before final render
 */
async function examplePreview() {
  const renderer = new VideoRenderer();
  await renderer.initialize();

  // Add canvas to DOM for preview
  renderer.canvas.style.width = "360px";
  renderer.canvas.style.height = "640px";
  document.body.appendChild(renderer.canvas);

  renderer.setBackground(["#ff9a9e", "#fecfef"], "gradient");
  renderer.setCaption("Preview mode - press button to record");

  // Preview loop (no recording)
  let previewTime = 0;
  const previewLoop = () => {
    renderer.renderFrame(previewTime);
    previewTime += 16; // ~60fps
    
    if (previewTime < 5000) {
      requestAnimationFrame(previewLoop);
    }
  };
  previewLoop();

  // Add record button
  const button = document.createElement("button");
  button.textContent = "Start Recording";
  button.onclick = async () => {
    const blob = await renderer.render(8000);
    renderer.download(blob, "preview-video.webm");
    document.body.removeChild(renderer.canvas);
    document.body.removeChild(button);
  };
  document.body.appendChild(button);
}

/**
 * Example 6: TTS Integration with Avatar Sync
 * Demonstrates avatar talking state sync with TTS
 */
async function exampleTTSSync() {
  const renderer = new VideoRenderer();
  await renderer.initialize();

  const avatar = new Avatar();
  renderer.setAvatar(avatar);
  renderer.setBackground("#1e3c72", "color");

  const caption = "Hello! I am your AI assistant. Watch my mouth move as I speak!";
  renderer.setCaption(caption, { y: 1700 });

  // Start TTS
  const tts = await renderer.textToSpeech(caption);
  console.log(`TTS duration: ${tts.duration}ms`);

  // Render for TTS duration + extra time
  const blob = await renderer.render(tts.duration + 2000);
  
  renderer.download(blob, "tts-sync-video.webm");
  renderer.dispose();
}

// Uncomment to run examples:
// exampleBasic();
// exampleAdvanced();
// exampleBatch();
// exampleCustomAnimation();
// examplePreview();
// exampleTTSSync();
