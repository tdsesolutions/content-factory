/**
 * AudioMixer - Web Audio API-based mixer for background music and TTS
 * Handles ducking, volume control, and seamless looping
 */
class AudioMixer {
  constructor(audioContext = null) {
    this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    
    // Track management
    this.currentTrack = null;
    this.trackBuffer = null;
    this.trackSource = null;
    
    // TTS audio
    this.ttsBuffer = null;
    this.ttsSource = null;
    
    // Gain nodes for volume control
    this.trackGain = this.ctx.createGain();
    this.ttsGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    
    // Volume settings
    this.musicVolume = 0.2;      // 20% during speech
    this.musicVolumeIdle = 0.7;  // 70% during pauses
    this.ttsVolume = 1.0;        // 100% for TTS
    
    // Ducking settings
    this.duckingAttack = 0.05;   // 50ms fade down
    this.duckingRelease = 0.3;   // 300ms fade up
    this.duckingThreshold = 0.01; // Audio level threshold
    
    // State
    this.isPlaying = false;
    this.isLooping = true;
    this.trackStartTime = 0;
    this.trackDuration = 0;
    
    // Analyser for voice activity detection (ducking)
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analysisData = new Uint8Array(this.analyser.frequencyBinCount);
    this.duckingInterval = null;
    
    // Connect audio graph
    this.trackGain.connect(this.masterGain);
    this.ttsGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    
    // Offline context for rendering
    this.offlineCtx = null;
  }

  /**
   * Load a background music track from URL
   * @param {string} url - URL to audio file (MP3/OGG)
   * @returns {Promise<AudioBuffer>}
   */
  async loadTrack(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load track: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.trackBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.trackDuration = this.trackBuffer.duration;
      this.currentTrack = url;
      
      console.log('[AudioMixer] Track loaded:', url, 'Duration:', this.trackDuration.toFixed(2) + 's');
      return this.trackBuffer;
    } catch (error) {
      console.error('[AudioMixer] Error loading track:', error);
      throw error;
    }
  }

  /**
   * Load track from ArrayBuffer (for pre-loaded files)
   * @param {ArrayBuffer} arrayBuffer - Raw audio data
   * @param {string} name - Track identifier
   * @returns {Promise<AudioBuffer>}
   */
  async loadTrackFromBuffer(arrayBuffer, name = 'buffer') {
    try {
      this.trackBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.trackDuration = this.trackBuffer.duration;
      this.currentTrack = name;
      
      console.log('[AudioMixer] Track loaded from buffer:', name, 'Duration:', this.trackDuration.toFixed(2) + 's');
      return this.trackBuffer;
    } catch (error) {
      console.error('[AudioMixer] Error decoding track buffer:', error);
      throw error;
    }
  }

  /**
   * Set TTS audio from Blob
   * @param {Blob} blob - TTS audio blob
   * @returns {Promise<AudioBuffer>}
   */
  async setTTSAudio(blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      this.ttsBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      
      console.log('[AudioMixer] TTS audio loaded, duration:', this.ttsBuffer.duration.toFixed(2) + 's');
      return this.ttsBuffer;
    } catch (error) {
      console.error('[AudioMixer] Error loading TTS audio:', error);
      throw error;
    }
  }

  /**
   * Set TTS audio from ArrayBuffer
   * @param {ArrayBuffer} arrayBuffer - TTS audio data
   * @returns {Promise<AudioBuffer>}
   */
  async setTTSAudioFromBuffer(arrayBuffer) {
    try {
      this.ttsBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      
      console.log('[AudioMixer] TTS audio loaded from buffer, duration:', this.ttsBuffer.duration.toFixed(2) + 's');
      return this.ttsBuffer;
    } catch (error) {
      console.error('[AudioMixer] Error decoding TTS buffer:', error);
      throw error;
    }
  }

  /**
   * Set volume levels
   * @param {Object} volumes - Volume settings
   * @param {number} volumes.music - Music volume during speech (0-1)
   * @param {number} volumes.musicIdle - Music volume during pauses (0-1)
   * @param {number} volumes.tts - TTS volume (0-1)
   */
  setVolumes(volumes = {}) {
    if (volumes.music !== undefined) this.musicVolume = Math.max(0, Math.min(1, volumes.music));
    if (volumes.musicIdle !== undefined) this.musicVolumeIdle = Math.max(0, Math.min(1, volumes.musicIdle));
    if (volumes.tts !== undefined) this.ttsVolume = Math.max(0, Math.min(1, volumes.tts));
    
    console.log('[AudioMixer] Volumes set:', {
      music: this.musicVolume,
      musicIdle: this.musicVolumeIdle,
      tts: this.ttsVolume
    });
  }

  /**
   * Set ducking parameters
   * @param {Object} params - Ducking settings
   * @param {number} params.attack - Fade down time in seconds
   * @param {number} params.release - Fade up time in seconds
   * @param {number} params.threshold - Audio detection threshold
   */
  setDucking(params = {}) {
    if (params.attack !== undefined) this.duckingAttack = Math.max(0.01, params.attack);
    if (params.release !== undefined) this.duckingRelease = Math.max(0.01, params.release);
    if (params.threshold !== undefined) this.duckingThreshold = Math.max(0, params.threshold);
  }

  /**
   * Start playing the background track with optional TTS
   * @param {Object} options - Playback options
   * @param {boolean} options.loop - Enable seamless looping
   * @param {boolean} options.ducking - Enable automatic ducking
   */
  async play(options = {}) {
    if (!this.trackBuffer) {
      throw new Error('No track loaded. Call loadTrack() first.');
    }
    
    this.isLooping = options.loop !== false;
    const enableDucking = options.ducking !== false && this.ttsBuffer;
    
    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    
    // Stop any existing playback
    this.stop();
    
    // Start background track
    this._startTrack();
    
    // Start TTS if available
    if (this.ttsBuffer) {
      this._startTTS();
    }
    
    // Start ducking if enabled
    if (enableDucking) {
      this._startDucking();
    } else {
      // Set music to idle volume if no ducking
      this.trackGain.gain.setValueAtTime(this.musicVolumeIdle, this.ctx.currentTime);
    }
    
    this.isPlaying = true;
    console.log('[AudioMixer] Playback started');
  }

  /**
   * Start the background track with seamless looping
   * @private
   */
  _startTrack() {
    const playLoop = () => {
      if (!this.isPlaying) return;
      
      this.trackSource = this.ctx.createBufferSource();
      this.trackSource.buffer = this.trackBuffer;
      this.trackSource.loop = false; // We handle looping manually for seamless transitions
      this.trackSource.connect(this.trackGain);
      
      this.trackStartTime = this.ctx.currentTime;
      this.trackSource.start();
      
      // Schedule next loop
      if (this.isLooping) {
        const loopDelay = Math.max(0, (this.trackDuration * 1000) - 50); // Slight overlap for seamlessness
        setTimeout(() => {
          if (this.isPlaying && this.isLooping) {
            playLoop();
          }
        }, loopDelay);
      }
      
      this.trackSource.onended = () => {
        this.trackSource = null;
      };
    };
    
    playLoop();
  }

  /**
   * Start TTS playback
   * @private
   */
  _startTTS() {
    this.ttsSource = this.ctx.createBufferSource();
    this.ttsSource.buffer = this.ttsBuffer;
    this.ttsSource.connect(this.ttsGain);
    this.ttsSource.connect(this.analyser); // Connect to analyser for ducking
    
    this.ttsGain.gain.setValueAtTime(this.ttsVolume, this.ctx.currentTime);
    this.ttsSource.start();
    
    this.ttsSource.onended = () => {
      this.ttsSource = null;
      this._stopDucking();
      // Fade music back to idle volume
      this.trackGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.trackGain.gain.setTargetAtTime(this.musicVolumeIdle, this.ctx.currentTime, this.duckingRelease);
    };
  }

  /**
   * Start voice activity detection for ducking
   * @private
   */
  _startDucking() {
    if (this.duckingInterval) {
      clearInterval(this.duckingInterval);
    }
    
    // Start with music at speech level
    this.trackGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    
    this.duckingInterval = setInterval(() => {
      if (!this.ttsSource) {
        this._stopDucking();
        return;
      }
      
      this.analyser.getByteFrequencyData(this.analysisData);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < this.analysisData.length; i++) {
        sum += this.analysisData[i];
      }
      const average = sum / this.analysisData.length / 255;
      
      // Apply ducking based on voice activity
      const now = this.ctx.currentTime;
      if (average > this.duckingThreshold) {
        // Voice detected - ensure music is at speech level
        if (this.trackGain.gain.value > this.musicVolume) {
          this.trackGain.gain.cancelScheduledValues(now);
          this.trackGain.gain.setTargetAtTime(this.musicVolume, now, this.duckingAttack);
        }
      } else {
        // Voice pause - raise music slightly
        if (this.trackGain.gain.value < this.musicVolumeIdle) {
          this.trackGain.gain.cancelScheduledValues(now);
          this.trackGain.gain.setTargetAtTime(this.musicVolumeIdle, now, this.duckingRelease);
        }
      }
    }, 50); // Check every 50ms
  }

  /**
   * Stop ducking interval
   * @private
   */
  _stopDucking() {
    if (this.duckingInterval) {
      clearInterval(this.duckingInterval);
      this.duckingInterval = null;
    }
  }

  /**
   * Stop all playback
   */
  stop() {
    this.isPlaying = false;
    
    this._stopDucking();
    
    if (this.trackSource) {
      try {
        this.trackSource.stop();
        this.trackSource.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.trackSource = null;
    }
    
    if (this.ttsSource) {
      try {
        this.ttsSource.stop();
        this.ttsSource.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.ttsSource = null;
    }
    
    console.log('[AudioMixer] Playback stopped');
  }

  /**
   * Pause playback (suspend audio context)
   */
  async pause() {
    if (this.ctx.state === 'running') {
      await this.ctx.suspend();
      console.log('[AudioMixer] Playback paused');
    }
  }

  /**
   * Resume playback
   */
  async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
      console.log('[AudioMixer] Playback resumed');
    }
  }

  /**
   * Mix audio offline and export as WAV blob
   * @param {Object} options - Mix options
   * @param {number} options.duration - Override mix duration (defaults to TTS duration or track duration)
   * @param {boolean} options.normalize - Normalize output volume
   * @returns {Promise<Blob>} - Mixed audio as WAV blob
   */
  async export(options = {}) {
    if (!this.trackBuffer) {
      throw new Error('No track loaded. Call loadTrack() first.');
    }
    
    const duration = options.duration || 
                      (this.ttsBuffer ? this.ttsBuffer.duration : this.trackDuration);
    const sampleRate = this.ctx.sampleRate;
    const numberOfChannels = 2; // Stereo output
    
    // Create offline context for rendering
    this.offlineCtx = new OfflineAudioContext(
      numberOfChannels,
      Math.ceil(duration * sampleRate),
      sampleRate
    );
    
    // Create offline nodes
    const offlineTrackGain = this.offlineCtx.createGain();
    const offlineTTSGain = this.offlineCtx.createGain();
    const offlineMasterGain = this.offlineCtx.createGain();
    
    // Connect graph
    offlineTrackGain.connect(offlineMasterGain);
    offlineTTSGain.connect(offlineMasterGain);
    offlineMasterGain.connect(this.offlineCtx.destination);
    
    // Set volumes
    offlineTrackGain.gain.value = this.musicVolume;
    offlineTTSGain.gain.value = this.ttsVolume;
    offlineMasterGain.gain.value = 0.9; // Prevent clipping
    
    // Schedule track playback (loop if needed)
    let trackTime = 0;
    while (trackTime < duration) {
      const trackSource = this.offlineCtx.createBufferSource();
      trackSource.buffer = this.trackBuffer;
      trackSource.connect(offlineTrackGain);
      trackSource.start(trackTime);
      trackTime += this.trackDuration;
    }
    
    // Schedule TTS if available
    if (this.ttsBuffer) {
      const ttsSource = this.offlineCtx.createBufferSource();
      ttsSource.buffer = this.ttsBuffer;
      ttsSource.connect(offlineTTSGain);
      ttsSource.start(0);
      
      // Simple ducking simulation: lower music at start of TTS
      const duckTime = 0.05;
      offlineTrackGain.gain.setValueAtTime(this.musicVolumeIdle, 0);
      offlineTrackGain.gain.setTargetAtTime(this.musicVolume, 0, duckTime);
      
      // Raise music after TTS ends
      const ttsEnd = this.ttsBuffer.duration;
      offlineTrackGain.gain.setTargetAtTime(this.musicVolumeIdle, ttsEnd, this.duckingRelease);
    } else {
      offlineTrackGain.gain.value = this.musicVolumeIdle;
    }
    
    // Render
    console.log('[AudioMixer] Rendering mix...');
    const renderedBuffer = await this.offlineCtx.startRendering();
    
    // Normalize if requested
    if (options.normalize) {
      this._normalizeBuffer(renderedBuffer);
    }
    
    // Convert to WAV blob
    const wavBlob = this._bufferToWav(renderedBuffer);
    
    console.log('[AudioMixer] Mix exported, size:', (wavBlob.size / 1024).toFixed(2) + 'KB');
    return wavBlob;
  }

  /**
   * Mix and export as MP3 (requires lamejs or similar encoder)
   * Returns WAV for now - convert to MP3 on server or add encoder
   * @param {Object} options - Export options
   * @returns {Promise<Blob>}
   */
  async exportAsMP3(options = {}) {
    // For now, export as WAV. MP3 encoding would require an additional library
    // like lamejs on the client or ffmpeg-wasm
    console.warn('[AudioMixer] MP3 export requires additional encoder. Exporting WAV.');
    return this.export(options);
  }

  /**
   * Mix and export as OGG (requires libvorbis or similar encoder)
   * @param {Object} options - Export options  
   * @returns {Promise<Blob>}
   */
  async exportAsOGG(options = {}) {
    // For now, export as WAV. OGG encoding would require an additional library
    console.warn('[AudioMixer] OGG export requires additional encoder. Exporting WAV.');
    return this.export(options);
  }

  /**
   * Get mixed audio as ArrayBuffer for further processing
   * @param {Object} options - Mix options
   * @returns {Promise<ArrayBuffer>}
   */
  async exportAsBuffer(options = {}) {
    const blob = await this.export(options);
    return await blob.arrayBuffer();
  }

  /**
   * Normalize audio buffer to prevent clipping
   * @private
   */
  _normalizeBuffer(buffer) {
    let max = 0;
    
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        max = Math.max(max, Math.abs(data[i]));
      }
    }
    
    if (max > 1) {
      const scale = 0.99 / max;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          data[i] *= scale;
        }
      }
    }
  }

  /**
   * Convert AudioBuffer to WAV Blob
   * @private
   */
  _bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // Write WAV header
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this._writeString(view, 8, 'WAVE');
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write interleaved audio data
    const offset = 44;
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let index = 0;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + index, intSample, true);
        index += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Write string to DataView
   * @private
   */
  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Get current state
   * @returns {Object}
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isLooping: this.isLooping,
      currentTrack: this.currentTrack,
      trackDuration: this.trackDuration,
      hasTTS: !!this.ttsBuffer,
      volumes: {
        music: this.musicVolume,
        musicIdle: this.musicVolumeIdle,
        tts: this.ttsVolume
      },
      contextState: this.ctx.state
    };
  }

  /**
   * Set master volume
   * @param {number} volume - 0 to 1
   */
  setMasterVolume(volume) {
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), now, 0.1);
  }

  /**
   * Fade out and stop
   * @param {number} duration - Fade duration in seconds
   */
  async fadeOut(duration = 1.0) {
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0, now, duration / 3);
    
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    this.stop();
    this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  /**
   * Destroy mixer and clean up resources
   */
  destroy() {
    this.stop();
    
    if (this.trackGain) this.trackGain.disconnect();
    if (this.ttsGain) this.ttsGain.disconnect();
    if (this.masterGain) this.masterGain.disconnect();
    if (this.analyser) this.analyser.disconnect();
    
    this.trackBuffer = null;
    this.ttsBuffer = null;
    
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    
    console.log('[AudioMixer] Destroyed');
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioMixer;
}

if (typeof window !== 'undefined') {
  window.AudioMixer = AudioMixer;
}

// ES Module export
export default AudioMixer;
