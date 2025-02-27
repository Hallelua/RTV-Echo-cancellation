// Utility functions for audio processing

/**
 * Converts an audio file to an ArrayBuffer
 * @param {File} file - The audio file to convert
 * @returns {Promise<ArrayBuffer>} - The audio data as an ArrayBuffer
 */
export function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Creates a Web Worker for audio processing
 * @returns {Worker} - The audio processing worker
 */
export function createAudioProcessingWorker() {
  // In a real implementation, you would use a proper worker loader
  // For this example, we'll assume the worker is available at the specified URL
  return new Worker(new URL('../workers/audio-processor.worker.js', import.meta.url), { type: 'module' });
}

/**
 * Decodes an audio file to an AudioBuffer
 * @param {ArrayBuffer} arrayBuffer - The audio data as an ArrayBuffer
 * @returns {Promise<AudioBuffer>} - The decoded audio data
 */
export async function decodeAudioData(arrayBuffer) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Creates a Blob URL from an ArrayBuffer
 * @param {ArrayBuffer} arrayBuffer - The audio data as an ArrayBuffer
 * @param {string} mimeType - The MIME type of the audio data
 * @returns {string} - The Blob URL
 */
export function arrayBufferToUrl(arrayBuffer, mimeType = 'audio/wav') {
  const blob = new Blob([arrayBuffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Visualizes audio data as a waveform
 * @param {HTMLCanvasElement} canvas - The canvas element to draw on
 * @param {Float32Array} audioData - The audio data to visualize
 * @param {string} color - The color of the waveform
 */
export function visualizeAudioWaveform(canvas, audioData, color = '#4f46e5') {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear the canvas
  ctx.clearRect(0, 0, width, height);
  
  // Set the line style
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  
  // Draw the waveform
  ctx.beginPath();
  
  const sliceWidth = width / audioData.length;
  let x = 0;
  
  for (let i = 0; i < audioData.length; i++) {
    const v = audioData[i] / 2 + 0.5; // Normalize to [0, 1]
    const y = height - (v * height);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    
    x += sliceWidth;
  }
  
  ctx.stroke();
}

/**
 * Calculates the RMS (Root Mean Square) value of an audio buffer
 * @param {Float32Array} buffer - The audio buffer
 * @returns {number} - The RMS value
 */
export function calculateRMS(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Normalizes an audio buffer to a target RMS value
 * @param {Float32Array} buffer - The audio buffer to normalize
 * @param {number} targetRMS - The target RMS value
 * @returns {Float32Array} - The normalized audio buffer
 */
export function normalizeAudio(buffer, targetRMS = 0.3) {
  const currentRMS = calculateRMS(buffer);
  const gain = targetRMS / currentRMS;
  
  const normalizedBuffer = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    normalizedBuffer[i] = buffer[i] * gain;
  }
  
  return normalizedBuffer;
}