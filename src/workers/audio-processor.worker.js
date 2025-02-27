// This is a Web Worker that handles the audio processing in a separate thread
// to prevent blocking the UI during intensive computations

// Import the WASM module
import { loadWasmModule, prepareAudioForProcessing, prepareAudioForPlayback } from '../wasm/echo-cancellation.js';

let wasmModule = null;

// Initialize the WASM module
async function initWasmModule() {
  try {
    wasmModule = await loadWasmModule();
    self.postMessage({ type: 'init', success: true });
  } catch (error) {
    self.postMessage({ type: 'init', success: false, error: error.message });
  }
}

// Process audio data
async function processAudio(audioData, settings) {
  try {
    if (!wasmModule) {
      throw new Error('WASM module not initialized');
    }
    
    // Prepare audio for processing
    const preparedAudio = prepareAudioForProcessing(audioData);
    
    // Process the audio using the WASM module
    const processedAudio = await wasmModule.processAudio(preparedAudio, settings);
    
    // Prepare the processed audio for playback
    const playbackAudio = prepareAudioForPlayback(processedAudio);
    
    // Send the processed audio back to the main thread
    self.postMessage(
      { 
        type: 'processed', 
        success: true, 
        data: playbackAudio 
      },
      [playbackAudio] // Transfer the buffer to avoid copying
    );
  } catch (error) {
    self.postMessage({ type: 'processed', success: false, error: error.message });
  }
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, data, settings } = event.data;
  
  switch (type) {
    case 'init':
      await initWasmModule();
      break;
    case 'process':
      await processAudio(data, settings);
      break;
    default:
      self.postMessage({ type: 'error', message: `Unknown message type: ${type}` });
  }
});

// Notify that the worker is ready
self.postMessage({ type: 'ready' });