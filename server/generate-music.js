const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUTPUT_DIR = '/home/teddiescott30/.openclaw/workspace/tds-content-factory-v2/server/music/tracks';
const TEMP_DIR = '/tmp/tds-music-gen';
const SAMPLE_RATE = 44100;

let FFMPEG = 'ffmpeg';
try {
  FFMPEG = require('ffmpeg-static');
} catch (e) {
  console.log('Using system ffmpeg');
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function sineWave(frequency, duration, sampleRate = SAMPLE_RATE) {
  const samples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  return buffer;
}

function triangleWave(frequency, duration, sampleRate = SAMPLE_RATE) {
  const samples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(samples);
  const period = sampleRate / frequency;
  for (let i = 0; i < samples; i++) {
    const phase = (i % period) / period;
    buffer[i] = 2 * Math.abs(2 * phase - 1) - 1;
  }
  return buffer;
}

function sawtoothWave(frequency, duration, sampleRate = SAMPLE_RATE) {
  const samples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(samples);
  const period = sampleRate / frequency;
  for (let i = 0; i < samples; i++) {
    buffer[i] = 2 * ((i % period) / period) - 1;
  }
  return buffer;
}

function squareWave(frequency, duration, sampleRate = SAMPLE_RATE) {
  const samples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(samples);
  const period = sampleRate / frequency;
  for (let i = 0; i < samples; i++) {
    buffer[i] = ((i % period) / period) < 0.5 ? 1 : -1;
  }
  return buffer;
}

function noise(duration, sampleRate = SAMPLE_RATE) {
  const samples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    buffer[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function applyEnvelope(buffer, attack, decay, sustain, release, duration) {
  const result = new Float32Array(buffer.length);
  const attackSamples = Math.floor(attack * SAMPLE_RATE);
  const decaySamples = Math.floor(decay * SAMPLE_RATE);
  const releaseSamples = Math.floor(release * SAMPLE_RATE);
  const sustainSamples = buffer.length - attackSamples - decaySamples - releaseSamples;
  
  for (let i = 0; i < buffer.length; i++) {
    let amp = 0;
    if (i < attackSamples) {
      amp = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      amp = 1 - (1 - sustain) * (i - attackSamples) / decaySamples;
    } else if (i < attackSamples + decaySamples + sustainSamples) {
      amp = sustain;
    } else {
      amp = sustain * (1 - (i - attackSamples - decaySamples - sustainSamples) / releaseSamples);
    }
    result[i] = buffer[i] * Math.max(0, amp);
  }
  return result;
}

function lowpass(buffer, cutoff, sampleRate = SAMPLE_RATE) {
  const rc = 1.0 / (2 * Math.PI * cutoff);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);
  const result = new Float32Array(buffer.length);
  result[0] = buffer[0];
  for (let i = 1; i < buffer.length; i++) {
    result[i] = result[i - 1] + alpha * (buffer[i] - result[i - 1]);
  }
  return result;
}

function mix(buffers, gains = null) {
  if (buffers.length === 0) return new Float32Array(0);
  const length = buffers[0].length;
  const result = new Float32Array(length);
  for (let i = 0; i < buffers.length; i++) {
    const gain = gains ? gains[i] : 1;
    for (let j = 0; j < length; j++) {
      result[j] += buffers[i][j] * gain;
    }
  }
  return result;
}

function normalize(buffer, target = 0.95) {
  let max = 0;
  for (let i = 0; i < buffer.length; i++) {
    max = Math.max(max, Math.abs(buffer[i]));
  }
  if (max === 0) return buffer;
  const result = new Float32Array(buffer.length);
  const scale = target / max;
  for (let i = 0; i < buffer.length; i++) {
    result[i] = buffer[i] * scale;
  }
  return result;
}

function addNote(track, noteBuffer, startTime, gain = 1.0) {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  for (let i = 0; i < noteBuffer.length; i++) {
    if (startSample + i < track.length) {
      track[startSample + i] += noteBuffer[i] * gain;
    }
  }
}

function writeWav(leftChannel, rightChannel, sampleRate = SAMPLE_RATE) {
  const length = leftChannel.length;
  const buffer = Buffer.alloc(44 + length * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + length * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(length * 4, 40);
  for (let i = 0; i < length; i++) {
    const left = Math.max(-32768, Math.min(32767, Math.floor(leftChannel[i] * 32767)));
    const right = Math.max(-32768, Math.min(32767, Math.floor(rightChannel[i] * 32767)));
    buffer.writeInt16LE(left, 44 + i * 4);
    buffer.writeInt16LE(right, 44 + i * 4 + 2);
  }
  return buffer;
}

function convertToMp3(wavPath, mp3Path, bitrate = 128) {
  const cmd = `${FFMPEG} -i "${wavPath}" -ar 44100 -ac 2 -b:a ${bitrate}k -y "${mp3Path}" 2>&1`;
  execSync(cmd);
}

async function generateUpbeatTech() {
  console.log('Generating: upbeat-tech.mp3...');
  const duration = 20;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const leftTrack = new Float32Array(totalSamples);
  const rightTrack = new Float32Array(totalSamples);
  const bpm = 128;
  const beatDuration = 60 / bpm;
  const numBeats = Math.floor(duration / beatDuration);

  for (let i = 0; i < numBeats; i++) {
    const time = i * beatDuration;
    const freq = i % 4 === 0 ? 55 : (i % 4 === 2 ? 55 : 41.25);
    const bass = sawtoothWave(freq, beatDuration * 0.8);
    const envBass = applyEnvelope(bass, 0.01, 0.1, 0.6, 0.2, beatDuration * 0.8);
    addNote(leftTrack, envBass, time, 0.3);
    addNote(rightTrack, envBass, time, 0.3);
    const bassHarmonic = squareWave(freq * 2, beatDuration * 0.5);
    const envHarm = applyEnvelope(bassHarmonic, 0.01, 0.05, 0.4, 0.1, beatDuration * 0.5);
    addNote(leftTrack, envHarm, time, 0.15);
    addNote(rightTrack, envHarm, time, 0.15);
  }

  for (let i = 0; i < numBeats * 2; i++) {
    const time = i * (beatDuration / 2);
    const hat = noise(0.05);
    const filteredHat = lowpass(hat, 8000);
    const envHat = applyEnvelope(filteredHat, 0.001, 0.02, 0, 0.03, 0.05);
    addNote(leftTrack, envHat, time, 0.08);
    addNote(rightTrack, envHat, time, 0.06);
  }

  for (let i = 0; i < numBeats; i++) {
    const time = i * beatDuration;
    const kick = sineWave(60, 0.15);
    const envKick = applyEnvelope(kick, 0.005, 0.1, 0, 0.1, 0.15);
    addNote(leftTrack, envKick, time, 0.8);
    addNote(rightTrack, envKick, time, 0.8);
    const kickClick = noise(0.03);
    const filteredClick = lowpass(kickClick, 200);
    addNote(leftTrack, filteredClick, time, 0.2);
    addNote(rightTrack, filteredClick, time, 0.2);
  }

  for (let i = 0; i < numBeats; i++) {
    if (i % 2 === 1) {
      const time = i * beatDuration;
      const snare = noise(0.1);
      const filteredSnare = lowpass(snare, 3000);
      const envSnare = applyEnvelope(filteredSnare, 0.005, 0.05, 0.3, 0.1, 0.1);
      addNote(leftTrack, envSnare, time, 0.35);
      addNote(rightTrack, envSnare, time, 0.35);
      const snareTone = sineWave(200, 0.1);
      const envTone = applyEnvelope(snareTone, 0.001, 0.05, 0, 0.05, 0.1);
      addNote(leftTrack, envTone, time, 0.2);
      addNote(rightTrack, envTone, time, 0.2);
    }
  }

  const arpNotes = [220, 277, 330, 440, 330, 277];
  for (let i = 0; i < numBeats * 2; i++) {
    const time = i * (beatDuration / 2);
    const freq = arpNotes[i % arpNotes.length];
    const arp = squareWave(freq, beatDuration * 0.4);
    const detuned = squareWave(freq * 1.005, beatDuration * 0.4);
    const mixed = mix([arp, detuned], [0.5, 0.5]);
    const envArp = applyEnvelope(mixed, 0.005, 0.1, 0.3, 0.15, beatDuration * 0.4);
    addNote(leftTrack, envArp, time, 0.1);
    addNote(rightTrack, envArp, time, 0.08);
  }

  const normLeft = normalize(leftTrack, 0.9);
  const normRight = normalize(rightTrack, 0.9);
  const wavBuffer = writeWav(normLeft, normRight);
  const wavPath = path.join(TEMP_DIR, 'upbeat-tech.wav');
  const mp3Path = path.join(OUTPUT_DIR, 'upbeat-tech.mp3');
  fs.writeFileSync(wavPath, wavBuffer);
  convertToMp3(wavPath, mp3Path, 128);
  const fileSize = fs.statSync(mp3Path).size;
  console.log(`  ✓ upbeat-tech.mp3 (${duration}s, ${(fileSize / 1024).toFixed(2)} KB)`);
  fs.unlinkSync(wavPath);
  return { duration, fileSize };
}

async function generateCorporateFocus() {
  console.log('Generating: corporate-focus.mp3...');
  const duration = 25;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const leftTrack = new Float32Array(totalSamples);
  const rightTrack = new Float32Array(totalSamples);
  const bpm = 100;
  const beatDuration = 60 / bpm;
  const numBeats = Math.floor(duration / beatDuration);

  const chords = [
    [261.63, 329.63, 392.00],
    [196.00, 246.94, 293.66],
    [220.00, 261.63, 329.63],
    [246.94, 293.66, 349.23]
  ];

  for (let i = 0; i < numBeats; i += 4) {
    const time = i * beatDuration;
    const chord = chords[Math.floor(i / 4) % chords.length];
    for (const freq of chord) {
      const note = sineWave(freq, beatDuration * 4);
      const envNote = applyEnvelope(note, 0.2, 0.5, 0.7, 1.0, beatDuration * 4);
      addNote(leftTrack, envNote, time, 0.15);
      addNote(rightTrack, envNote, time, 0.15);
      const bass = triangleWave(freq / 2, beatDuration * 4);
      const envBass = applyEnvelope(bass, 0.3, 0.5, 0.6, 1.0, beatDuration * 4);
      addNote(leftTrack, envBass, time, 0.1);
      addNote(rightTrack, envBass, time, 0.1);
    }
  }

  for (let i = 0; i < numBeats; i++) {
    const time = i * beatDuration;
    const kick = sineWave(50, 0.2);
    const envKick = applyEnvelope(kick, 0.01, 0.1, 0, 0.15, 0.2);
    addNote(leftTrack, envKick, time, 0.4);
    addNote(rightTrack, envKick, time, 0.4);
  }

  for (let i = 0; i < numBeats * 2; i++) {
    const time = i * (beatDuration / 2);
    const hat = noise(0.03);
    const filteredHat = lowpass(hat, 10000);
    const envHat = applyEnvelope(filteredHat, 0.001, 0.01, 0, 0.02, 0.03);
    addNote(leftTrack, envHat, time, 0.05);
    addNote(rightTrack, envHat, time, 0.04);
  }

  for (let i = 0; i < numBeats; i += 2) {
    const time = i * beatDuration;
    const bass = sineWave(65, beatDuration * 2);
    const envBass = applyEnvelope(bass, 0.1, 0.3, 0.7, 0.5, beatDuration * 2);
    addNote(leftTrack, envBass, time, 0.2);
    addNote(rightTrack, envBass, time, 0.2);
  }

  const normLeft = normalize(leftTrack, 0.9);
  const normRight = normalize(rightTrack, 0.9);
  const wavBuffer = writeWav(normLeft, normRight);
  const wavPath = path.join(TEMP_DIR, 'corporate-focus.wav');
  const mp3Path = path.join(OUTPUT_DIR, 'corporate-focus.mp3');
  fs.writeFileSync(wavPath, wavBuffer);
  convertToMp3(wavPath, mp3Path, 128);
  const fileSize = fs.statSync(mp3Path).size;
  console.log(`  ✓ corporate-focus.mp3 (${duration}s, ${(fileSize / 1024).toFixed(2)} KB)`);
  fs.unlinkSync(wavPath);
  return { duration, fileSize };
}

async function generateLofiChill() {
  console.log('Generating: lofi-chill.mp3...');
  const duration = 22;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const leftTrack = new Float32Array(totalSamples);
  const rightTrack = new Float32Array(totalSamples);
  const bpm = 85;
  const beatDuration = 60 / bpm;
  const numBeats = Math.floor(duration / beatDuration);

  const chords = [
    [130.81, 155.56, 196.00, 233.08],
    [98.00, 116.54, 146.83, 174.61],
    [110.00, 130.81, 164.81, 196.00],
    [116.54, 146.83, 174.61, 220.00]
  ];

  for (let i = 0; i < numBeats; i += 4) {
    const time = i * beatDuration;
    const chord = chords[Math.floor(i / 4) % chords.length];
    for (const freq of chord) {
      const detune = (Math.random() - 0.5) * 15;
      const note = sineWave(freq * Math.pow(2, detune / 1200), beatDuration * 4);
      const envNote = applyEnvelope(note, 0.3, 0.8, 0.6, 1.5, beatDuration * 4);
      addNote(leftTrack, envNote, time, 0.12);
      addNote(rightTrack, envNote, time, 0.1);
      const harmonic = triangleWave(freq, beatDuration * 4);
      const envHarm = applyEnvelope(harmonic, 0.2, 0.6, 0.5, 1.0, beatDuration * 4);
      addNote(leftTrack, envHarm, time, 0.06);
      addNote(rightTrack, envHarm, time, 0.06);
    }
  }

  for (let i = 0; i < numBeats; i += 2) {
    const time = i * beatDuration;
    const kick = sineWave(55, 0.25);
    const envKick = applyEnvelope(kick, 0.01, 0.15, 0, 0.15, 0.25);
    addNote(leftTrack, envKick, time, 0.5);
    addNote(rightTrack, envKick, time, 0.5);
  }

  for (let i = 0; i < duration * 10; i++) {
    const time = (i / 10) + Math.random() * 0.05;
    const crackle = noise(0.01);
    const filteredCrackle = lowpass(crackle, 5000);
    const gain = 0.015 + Math.random() * 0.01;
    addNote(leftTrack, filteredCrackle, time, gain);
    addNote(rightTrack, filteredCrackle, time, gain * 0.8);
  }

  for (let i = 1; i < numBeats; i += 2) {
    const time = i * beatDuration;
    const snare = noise(0.08);
    const filteredSnare = lowpass(snare, 2500);
    const envSnare = applyEnvelope(filteredSnare, 0.005, 0.05, 0.2, 0.15, 0.08);
    addNote(leftTrack, envSnare, time, 0.18);
    addNote(rightTrack, envSnare, time, 0.18);
  }

  const bassNotes = [65, 49, 55, 58];
  for (let i = 0; i < numBeats; i += 4) {
    const time = i * beatDuration;
    const bassFreq = bassNotes[Math.floor(i / 4) % 4];
    const bass = sineWave(bassFreq, beatDuration * 4);
    const envBass = applyEnvelope(bass, 0.2, 0.5, 0.7, 1.0, beatDuration * 4);
    addNote(leftTrack, envBass, time, 0.2);
    addNote(rightTrack, envBass, time, 0.2);
  }

  const normLeft = normalize(leftTrack, 0.9);
  const normRight = normalize(rightTrack, 0.9);
  const wavBuffer = writeWav(normLeft, normRight);
  const wavPath = path.join(TEMP_DIR, 'lofi-chill.wav');
  const mp3Path = path.join(OUTPUT_DIR, 'lofi-chill.mp3');
  fs.writeFileSync(wavPath, wavBuffer);
  convertToMp3(wavPath, mp3Path, 128);
  const fileSize = fs.statSync(mp3Path).size;
  console.log(`  ✓ lofi-chill.mp3 (${duration}s, ${(fileSize / 1024).toFixed(2)} KB)`);
  fs.unlinkSync(wavPath);
  return { duration, fileSize };
}

async function generateCinematicBuild() {
  console.log('Generating: cinematic-build.mp3...');
  const duration = 30;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const leftTrack = new Float32Array(totalSamples);
  const rightTrack = new Float32Array(totalSamples);
  const bpm = 110;
  const beatDuration = 60 / bpm;

  const padFreqs = [110, 146.83, 174.61, 220];
  for (let i = 0; i < duration; i += 2) {
    const time = i;
    const buildGain = 0.1 + (i / duration) * 0.25;
    for (const freq of padFreqs) {
      const saw = sawtoothWave(freq, 4);
      const envSaw = applyEnvelope(saw, 0.5, 1.0, 0.8, 1.5, 4);
      addNote(leftTrack, envSaw, time, buildGain * 0.25);
      addNote(rightTrack, envSaw, time, buildGain * 0.22);
      const sub = sineWave(freq / 2, 4);
      const envSub = applyEnvelope(sub, 0.8, 1.2, 0.9, 2.0, 4);
      addNote(leftTrack, envSub, time, buildGain * 0.35);
      addNote(rightTrack, envSub, time, buildGain * 0.35);
    }
  }

  for (let i = 0; i < duration; i += 2) {
    const time = i;
    const intensity = 0.25 + (i / duration) * 0.5;
    const kick = sineWave(40, 0.3);
    const envKick = applyEnvelope(kick, 0.01, 0.2, 0, 0.2, 0.3);
    addNote(leftTrack, envKick, time, intensity);
    addNote(rightTrack, envKick, time, intensity);
    const noiseHit = noise(0.05);
    const filteredNoise = lowpass(noiseHit, 400);
    addNote(leftTrack, filteredNoise, time, intensity * 0.4);
    addNote(rightTrack, filteredNoise, time, intensity * 0.4);
  }

  for (let i = 0; i < duration; i += 4) {
    const time = i;
    const high1 = sineWave(880, 3);
    const envHigh1 = applyEnvelope(high1, 0.5, 1.0, 0.6, 1.5, 3);
    addNote(leftTrack, envHigh1, time, 0.1);
    addNote(rightTrack, envHigh1, time, 0.08);
    const high2 = sineWave(1108.73, 2);
    const envHigh2 = applyEnvelope(high2, 0.3, 0.8, 0.5, 1.0, 2);
    addNote(leftTrack, envHigh2, time + 1, 0.08);
    addNote(rightTrack, envHigh2, time + 1, 0.08);
  }

  for (let i = 4; i < duration; i += 8) {
    const time = i;
    const brass1 = squareWave(220, 6);
    const envBrass1 = applyEnvelope(brass1, 1.0, 2.0, 0.7, 3.0, 6);
    addNote(leftTrack, envBrass1, time, 0.12);
    addNote(rightTrack, envBrass1, time, 0.1);
    const brass2 = squareWave(329.63, 4);
    const envBrass2 = applyEnvelope(brass2, 0.8, 1.5, 0.6, 2.0, 4);
    addNote(leftTrack, envBrass2, time + 2, 0.1);
    addNote(rightTrack, envBrass2, time + 2, 0.08);
  }

  const normLeft = normalize(leftTrack, 0.9);
  const normRight = normalize(rightTrack, 0.9);
  const wavBuffer = writeWav(normLeft, normRight);
  const wavPath = path.join(TEMP_DIR, 'cinematic-build.wav');
  const mp3Path = path.join(OUTPUT_DIR, 'cinematic-build.mp3');
  fs.writeFileSync(wavPath, wavBuffer);
  convertToMp3(wavPath, mp3Path, 128);
  const fileSize = fs.statSync(mp3Path).size;
  console.log(`  ✓ cinematic-build.mp3 (${duration}s, ${(fileSize / 1024).toFixed(2)} KB)`);
  fs.unlinkSync(wavPath);
  return { duration, fileSize };
}

async function generateMinimalTech() {
  console.log('Generating: minimal-tech.mp3...');
  const duration = 18;
  const totalSamples = Math.floor(duration * SAMPLE_RATE);
  const leftTrack = new Float32Array(totalSamples);
  const rightTrack = new Float32Array(totalSamples);
  const bpm = 90;
  const beatDuration = 60 / bpm;
  const numBeats = Math.floor(duration / beatDuration);

  for (let i = 0; i < duration; i += 4) {
    const time = i;
    const drone1 = sineWave(110, 6);
    const envDrone1 = applyEnvelope(drone1, 1.0, 2.0, 0.8, 2.0, 6);
    addNote(leftTrack, envDrone1, time, 0.15);
    addNote(rightTrack, envDrone1, time, 0.15);
    const drone2 = sineWave(164.81, 6);
    const envDrone2 = applyEnvelope(drone2, 1.2, 2.0, 0.75, 2.0, 6);
    addNote(leftTrack, envDrone2, time, 0.12);
    addNote(rightTrack, envDrone2, time, 0.12);
    const drone3 = triangleWave(82.41, 6);
    const envDrone3 = applyEnvelope(drone3, 0.8, 1.5, 0.7, 2.0, 6);
    addNote(leftTrack, envDrone3, time, 0.06);
    addNote(rightTrack, envDrone3, time, 0.06);
  }

  for (let i = 0; i < numBeats; i += 4) {
    const time = i * beatDuration;
    const kick = sineWave(45, 0.2);
    const envKick = applyEnvelope(kick, 0.01, 0.1, 0, 0.15, 0.2);
    addNote(leftTrack, envKick, time, 0.3);
    addNote(rightTrack, envKick, time, 0.3);
  }

  for (let i = 0; i < duration * 4; i++) {
    const time = i * 0.25;
    const tex = noise(0.1);
    const filtered = lowpass(tex, 2000);
    const gain = 0.02 + Math.random() * 0.03;
    addNote(leftTrack, filtered, time, gain);
    addNote(rightTrack, filtered, time, gain * 0.9);
  }

  for (let i = 0; i < numBeats; i += 8) {
    const time = i * beatDuration;
    const blip1 = sineWave(880, 0.2);
    const envBlip1 = applyEnvelope(blip1, 0.001, 0.1, 0, 0.1, 0.2);
    addNote(leftTrack, envBlip1, time + 1, 0.05);
    addNote(rightTrack, envBlip1, time + 1, 0.04);
    const blip2 = sineWave(880, 0.2);
    const envBlip2 = applyEnvelope(blip2, 0.001, 0.1, 0, 0.1, 0.2);
    addNote(leftTrack, envBlip2, time + 1.25, 0.05);
    addNote(rightTrack, envBlip2, time + 1.25, 0.04);
  }

  const normLeft = normalize(leftTrack, 0.9);
  const normRight = normalize(rightTrack, 0.9);
  const wavBuffer = writeWav(normLeft, normRight);
  const wavPath = path.join(TEMP_DIR, 'minimal-tech.wav');
  const mp3Path = path.join(OUTPUT_DIR, 'minimal-tech.mp3');
  fs.writeFileSync(wavPath, wavBuffer);
  convertToMp3(wavPath, mp3Path, 128);
  const fileSize = fs.statSync(mp3Path).size;
  console.log(`  ✓ minimal-tech.mp3 (${duration}s, ${(fileSize / 1024).toFixed(2)} KB)`);
  fs.unlinkSync(wavPath);
  return { duration, fileSize };
}

async function main() {
  console.log('\n🎵 TDS Content Factory - Music Generator\n');
  const results = {};
  try {
    results['upbeat-tech'] = await generateUpbeatTech();
    results['corporate-focus'] = await generateCorporateFocus();
    results['lofi-chill'] = await generateLofiChill();
    results['cinematic-build'] = await generateCinematicBuild();
    results['minimal-tech'] = await generateMinimalTech();
    console.log('\n✅ All tracks generated!\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'generated-info.json'), JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
