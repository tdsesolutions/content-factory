/**
 * KiarosX Avatar Animation Engine
 * Renders a floating glass sphere avatar with energy effects
 * @version 1.0.0
 */
class KiarosXAvatar {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    
    // Avatar configuration
    this.config = {
      size: 80, // diameter in pixels
      baseColor: '#00E5FF',
      glowColor: '#00E5FF',
      secondaryColor: '#0088AA',
      accentColor: '#CCFFFF'
    };
    
    // State configuration
    this.states = {
      idle: {
        rotationSpeed: 0.005,
        pulseDuration: 4200,
        particleCount: 12,
        particleSpeed: 0.3,
        glowIntensity: 0.4,
        latticeBrightness: 0.6,
        energySpikes: false
      },
      talking: {
        rotationSpeed: 0.015,
        pulseDuration: 1800,
        particleCount: 20,
        particleSpeed: 0.8,
        glowIntensity: 0.8,
        latticeBrightness: 1.0,
        energySpikes: false
      },
      executing: {
        rotationSpeed: 0.035,
        pulseDuration: 900,
        particleCount: 35,
        particleSpeed: 1.5,
        glowIntensity: 1.0,
        latticeBrightness: 1.0,
        energySpikes: true
      }
    };
    
    // Current state
    this.currentState = 'idle';
    this.stateConfig = this.states.idle;
    
    // Animation timing
    this.lastTime = 0;
    this.pulsePhase = 0;
    this.rotationAngle = 0;
    this.time = 0;
    
    // Particles
    this.particles = [];
    this.initParticles();
    
    // Sound waves for talking state
    this.soundWaves = [];
    
    // Position (upper right corner)
    this.updatePosition();
    
    // Animation frame ID for cleanup
    this.animationId = null;
    
    // Bind methods
    this.render = this.render.bind(this);
    this.updatePosition = this.updatePosition.bind(this);
    
    // Handle resize
    window.addEventListener('resize', this.updatePosition);
    
    // Start animation
    this.start();
  }
  
  updatePosition() {
    // Position in upper right corner with padding
    const padding = 20;
    this.x = this.canvas.width - (this.config.size / 2) - padding;
    this.y = (this.config.size / 2) + padding;
    this.radius = this.config.size / 2;
  }
  
  initParticles() {
    this.particles = [];
    const maxParticles = Math.max(
      this.states.idle.particleCount,
      this.states.talking.particleCount,
      this.states.executing.particleCount
    );
    
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        angle: (Math.PI * 2 * i) / maxParticles,
        distance: this.radius * (1.1 + Math.random() * 0.4),
        speed: 0.02 + Math.random() * 0.03,
        size: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
  
  setState(state) {
    if (!this.states[state]) {
      console.warn(`Unknown state: ${state}`);
      return;
    }
    
    this.currentState = state;
    this.stateConfig = this.states[state];
    
    // Reset pulse phase for smooth transition
    this.pulsePhase = 0;
  }
  
  start() {
    if (!this.animationId) {
      this.lastTime = performance.now();
      this.render();
    }
  }
  
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  destroy() {
    this.stop();
    window.removeEventListener('resize', this.updatePosition);
  }
  
  update(deltaTime) {
    this.time += deltaTime;
    
    // Update rotation
    this.rotationAngle += this.stateConfig.rotationSpeed * deltaTime * 0.06;
    
    // Update pulse phase
    this.pulsePhase += (deltaTime / this.stateConfig.pulseDuration) * Math.PI * 2;
    
    // Update particles
    const activeParticles = this.stateConfig.particleCount;
    for (let i = 0; i < activeParticles; i++) {
      const p = this.particles[i];
      p.angle += p.speed * this.stateConfig.particleSpeed;
      p.distance = this.radius * (1.1 + Math.sin(this.time * 0.001 + p.phase) * 0.15);
    }
    
    // Update sound waves for talking state
    if (this.currentState === 'talking') {
      // Spawn new sound wave occasionally
      if (Math.random() < 0.05) {
        this.soundWaves.push({
          radius: this.radius,
          opacity: 1,
          expansionRate: 2
        });
      }
    }
    
    // Update existing sound waves
    this.soundWaves = this.soundWaves.filter(wave => {
      wave.radius += wave.expansionRate * (deltaTime * 0.06);
      wave.opacity -= 0.02 * (deltaTime * 0.06);
      return wave.opacity > 0;
    });
    
    // Energy spikes for executing state
    if (this.stateConfig.energySpikes && Math.random() < 0.1) {
      this.soundWaves.push({
        radius: this.radius,
        opacity: 0.8,
        expansionRate: 4,
        isSpike: true
      });
    }
  }
  
  render() {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;
    
    this.update(deltaTime);
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Update position (in case canvas resized)
    this.updatePosition();
    
    // Draw all layers
    this.drawGlow();
    this.drawParticles();
    this.drawSphere();
    this.drawLattice();
    this.drawKSymbol();
    this.drawSoundWaves();
    this.drawEnergySpikes();
    
    this.animationId = requestAnimationFrame(this.render);
  }
  
  drawGlow() {
    const pulseValue = (Math.sin(this.pulsePhase) + 1) / 2;
    const glowSize = this.radius * (1.5 + pulseValue * 0.5);
    const alpha = this.stateConfig.glowIntensity * (0.3 + pulseValue * 0.4);
    
    // Outer glow
    const gradient = this.ctx.createRadialGradient(
      this.x, this.y, this.radius * 0.5,
      this.x, this.y, glowSize
    );
    gradient.addColorStop(0, `rgba(0, 229, 255, ${alpha})`);
    gradient.addColorStop(0.5, `rgba(0, 136, 170, ${alpha * 0.5})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    this.ctx.save();
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      this.x - glowSize, this.y - glowSize,
      glowSize * 2, glowSize * 2
    );
    this.ctx.restore();
  }
  
  drawParticles() {
    const activeParticles = this.stateConfig.particleCount;
    
    this.ctx.save();
    for (let i = 0; i < activeParticles; i++) {
      const p = this.particles[i];
      const px = this.x + Math.cos(p.angle) * p.distance;
      const py = this.y + Math.sin(p.angle) * p.distance;
      
      const twinkle = (Math.sin(this.time * 0.005 + p.phase) + 1) / 2;
      const alpha = 0.4 + twinkle * 0.6;
      
      this.ctx.beginPath();
      this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`;
      this.ctx.fill();
      
      // Particle glow
      const particleGlow = this.ctx.createRadialGradient(
        px, py, 0,
        px, py, p.size * 3
      );
      particleGlow.addColorStop(0, `rgba(0, 229, 255, ${alpha * 0.5})`);
      particleGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = particleGlow;
      this.ctx.beginPath();
      this.ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }
  
  drawSphere() {
    const pulseValue = (Math.sin(this.pulsePhase) + 1) / 2;
    
    this.ctx.save();
    
    // Main sphere body with glass effect
    const sphereGradient = this.ctx.createRadialGradient(
      this.x - this.radius * 0.3, this.y - this.radius * 0.3, 0,
      this.x, this.y, this.radius
    );
    sphereGradient.addColorStop(0, 'rgba(200, 255, 255, 0.4)');
    sphereGradient.addColorStop(0.3, 'rgba(0, 229, 255, 0.2)');
    sphereGradient.addColorStop(0.7, 'rgba(0, 136, 170, 0.3)');
    sphereGradient.addColorStop(1, 'rgba(0, 80, 100, 0.5)');
    
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = sphereGradient;
    this.ctx.fill();
    
    // Glass reflection highlight
    const highlightGradient = this.ctx.createRadialGradient(
      this.x - this.radius * 0.4, this.y - this.radius * 0.4, 0,
      this.x - this.radius * 0.4, this.y - this.radius * 0.4, this.radius * 0.5
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    this.ctx.beginPath();
    this.ctx.arc(
      this.x - this.radius * 0.3,
      this.y - this.radius * 0.3,
      this.radius * 0.25,
      0, Math.PI * 2
    );
    this.ctx.fillStyle = highlightGradient;
    this.ctx.fill();
    
    // Glass rim
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(0, 229, 255, ${0.3 + pulseValue * 0.3})`;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    
    // Inner glass rim
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius * 0.92, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(0, 229, 255, ${0.1 + pulseValue * 0.2})`;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    
    this.ctx.restore();
  }
  
  drawLattice() {
    const brightness = this.stateConfig.latticeBrightness;
    const pulseValue = (Math.sin(this.pulsePhase) + 1) / 2;
    const alpha = brightness * (0.4 + pulseValue * 0.4);
    
    this.ctx.save();
    this.ctx.translate(this.x, this.y);
    this.ctx.rotate(this.rotationAngle);
    
    this.ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
    this.ctx.lineWidth = 0.8;
    this.ctx.lineCap = 'round';
    
    // Draw latitude lines (horizontal rings)
    const latitudes = 3;
    for (let i = 1; i <= latitudes; i++) {
      const r = (this.radius * 0.85 * i) / (latitudes + 1);
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, r * 1.5, r, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    // Draw longitude lines (vertical arcs)
    const longitudes = 6;
    for (let i = 0; i < longitudes; i++) {
      const angle = (Math.PI * 2 * i) / longitudes;
      this.ctx.save();
      this.ctx.rotate(angle);
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, this.radius * 0.4, this.radius * 0.85, 0, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
    
    this.ctx.restore();
  }
  
  drawKSymbol() {
    const pulseValue = (Math.sin(this.pulsePhase) + 1) / 2;
    const scale = 1 + pulseValue * 0.05;
    
    this.ctx.save();
    this.ctx.translate(this.x, this.y);
    this.ctx.rotate(this.rotationAngle * 0.5); // Slower rotation for K
    this.ctx.scale(scale, scale);
    
    const kSize = this.radius * 0.5;
    const lineWidth = 3;
    const glowSize = 8;
    
    // Glow effect behind K
    this.ctx.shadowColor = this.config.baseColor;
    this.ctx.shadowBlur = glowSize + pulseValue * 8;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    this.ctx.strokeStyle = this.config.baseColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    
    // Vertical stroke of K
    this.ctx.moveTo(-kSize * 0.3, -kSize * 0.6);
    this.ctx.lineTo(-kSize * 0.3, kSize * 0.6);
    
    // Upper diagonal
    this.ctx.moveTo(-kSize * 0.3, 0);
    this.ctx.lineTo(kSize * 0.4, -kSize * 0.6);
    
    // Lower diagonal
    this.ctx.moveTo(-kSize * 0.1, -kSize * 0.1);
    this.ctx.lineTo(kSize * 0.4, kSize * 0.6);
    
    this.ctx.stroke();
    
    // Inner fill for K (subtle)
    this.ctx.strokeStyle = `rgba(204, 255, 255, ${0.3 + pulseValue * 0.3})`;
    this.ctx.lineWidth = lineWidth * 0.5;
    this.ctx.stroke();
    
    this.ctx.restore();
  }
  
  drawSoundWaves() {
    if (this.soundWaves.length === 0) return;
    
    this.ctx.save();
    
    for (const wave of this.soundWaves) {
      if (wave.isSpike) continue;
      
      this.ctx.beginPath();
      this.ctx.arc(this.x, this.y, wave.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(0, 229, 255, ${wave.opacity * 0.6})`;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Inner wave
      this.ctx.beginPath();
      this.ctx.arc(this.x, this.y, wave.radius * 0.8, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(0, 229, 255, ${wave.opacity * 0.3})`;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }
  
  drawEnergySpikes() {
    if (!this.stateConfig.energySpikes) return;
    
    const spikeCount = 8;
    const spikeLength = this.radius * (0.3 + Math.sin(this.pulsePhase) * 0.2);
    
    this.ctx.save();
    this.ctx.translate(this.x, this.y);
    this.ctx.rotate(this.rotationAngle * 2);
    
    this.ctx.strokeStyle = `rgba(0, 229, 255, ${0.6 + Math.sin(this.pulsePhase) * 0.4})`;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    
    for (let i = 0; i < spikeCount; i++) {
      const angle = (Math.PI * 2 * i) / spikeCount;
      const sx = Math.cos(angle) * this.radius;
      const sy = Math.sin(angle) * this.radius;
      const ex = Math.cos(angle) * (this.radius + spikeLength);
      const ey = Math.sin(angle) * (this.radius + spikeLength);
      
      this.ctx.beginPath();
      this.ctx.moveTo(sx, sy);
      this.ctx.lineTo(ex, ey);
      this.ctx.stroke();
      
      // Spike glow
      this.ctx.shadowColor = this.config.baseColor;
      this.ctx.shadowBlur = 10;
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }
    
    this.ctx.restore();
  }
  
  // Getter for current state
  getState() {
    return this.currentState;
  }
  
  // Resize handler
  resize() {
    this.updatePosition();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KiarosXAvatar;
}
