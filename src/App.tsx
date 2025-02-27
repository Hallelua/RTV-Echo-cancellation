import React, { useState, useRef, useEffect } from 'react';
import { Upload, Mic, StopCircle, Play, Download, AudioWaveform as Waveform, Settings, Info, Loader2 } from 'lucide-react';
import { loadWasmModule } from './wasm/echo-cancellation';

// WebAssembly module will be loaded here
let wasmModule: any = null;

function App() {
  // State for audio processing
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedAudio, setProcessedAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>('upload');
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // Refs for audio elements
  const audioInputRef = useRef<HTMLAudioElement>(null);
  const audioOutputRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Settings state
  const [settings, setSettings] = useState({
    filterLength: 512, // Increased default filter length for better echo cancellation
    stepSize: 0.05,    // Reduced default step size for more stable adaptation
    showAdvancedSettings: false
  });

  // Load WebAssembly module
  useEffect(() => {
    async function initWasmModule() {
      try {
        console.log('Loading WASM module...');
        wasmModule = await loadWasmModule();
        console.log('WASM module loaded successfully');
      } catch (error) {
        console.error('Failed to load WASM module:', error);
      }
    }
    
    initWasmModule();
  }, []);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setAudioFile(file);
      
      // Create object URL for the audio element
      const objectUrl = URL.createObjectURL(file);
      if (audioInputRef.current) {
        audioInputRef.current.src = objectUrl;
      }
      
      // Reset processed audio
      setProcessedAudio(null);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false, // Disable browser's echo cancellation
          noiseSuppression: false, // Disable browser's noise suppression
          autoGainControl: false   // Disable auto gain control
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        if (audioInputRef.current) {
          audioInputRef.current.src = audioUrl;
        }
        setAudioFile(new File([audioBlob], 'recording.wav', { type: 'audio/wav' }));
        setProcessedAudio(null);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all tracks on the stream
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Process audio with progress updates
  const processAudio = async () => {
    if (!audioFile || !wasmModule) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      // Read the audio file as ArrayBuffer
      const arrayBuffer = await audioFile.arrayBuffer();
      
      // Set up progress tracking
      const totalSteps = 20; // Simulate 20 steps of processing
      let currentStep = 0;
      
      const updateProgress = () => {
        currentStep++;
        const progress = Math.min(Math.floor((currentStep / totalSteps) * 100), 99);
        setProcessingProgress(progress);
        return new Promise(resolve => setTimeout(resolve, 100));
      };
      
      // Process the audio using WebAssembly with progress updates
      await updateProgress(); // Initial progress update
      
      // Process in chunks to allow for progress updates
      const processedBuffer = await wasmModule.processAudio(arrayBuffer, {
        filterLength: settings.filterLength,
        stepSize: settings.stepSize
      });
      
      // Simulate remaining progress steps
      while (currentStep < totalSteps) {
        await updateProgress();
      }
      
      // Create a new Blob from the processed buffer
      const processedBlob = new Blob([processedBuffer], { type: 'audio/wav' });
      const processedUrl = URL.createObjectURL(processedBlob);
      
      setProcessedAudio(processedUrl);
      if (audioOutputRef.current) {
        audioOutputRef.current.src = processedUrl;
      }
      
      setProcessingProgress(100);
    } catch (error) {
      console.error('Error processing audio:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Play/pause processed audio
  const togglePlayback = () => {
    if (audioOutputRef.current) {
      if (isPlaying) {
        audioOutputRef.current.pause();
      } else {
        audioOutputRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Download processed audio
  const downloadProcessedAudio = () => {
    if (processedAudio) {
      const a = document.createElement('a');
      a.href = processedAudio;
      a.download = 'processed_audio.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Update settings
  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  // Toggle advanced settings
  const toggleAdvancedSettings = () => {
    setSettings({
      ...settings,
      showAdvancedSettings: !settings.showAdvancedSettings
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Waveform className="text-indigo-600 mr-2" size={32} />
            <h1 className="text-3xl font-bold text-gray-800">RTV Echo Cancellation</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Enhance your audio by removing noise and echo using our advanced WebAssembly-powered processing engine.
          </p>
        </header>

        <main className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                className={`px-4 py-2 font-medium text-sm rounded-t-lg ${
                  activeTab === 'upload'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-indigo-600'
                }`}
                onClick={() => setActiveTab('upload')}
              >
                <Upload className="inline mr-2" size={16} />
                Upload Audio
              </button>
              <button
                className={`px-4 py-2 font-medium text-sm rounded-t-lg ${
                  activeTab === 'record'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-indigo-600'
                }`}
                onClick={() => setActiveTab('record')}
              >
                <Mic className="inline mr-2" size={16} />
                Record Audio
              </button>
            </div>

            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <div className="mb-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="audio-upload"
                  />
                  <label
                    htmlFor="audio-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="text-indigo-600 mb-2" size={48} />
                    <span className="text-gray-700 font-medium">
                      Click to upload audio file
                    </span>
                    <span className="text-gray-500 text-sm mt-1">
                      Supports WAV, MP3, AAC formats
                    </span>
                  </label>
                </div>
                {audioFile && (
                  <div className="mt-4">
                    <p className="text-gray-700">
                      Selected file: <span className="font-medium">{audioFile.name}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Record Tab */}
            {activeTab === 'record' && (
              <div className="mb-6">
                <div className="border-2 border-gray-300 rounded-lg p-8 text-center">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 transition-all"
                    >
                      <Mic size={32} />
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="bg-gray-700 hover:bg-gray-800 text-white rounded-full p-4 transition-all animate-pulse"
                    >
                      <StopCircle size={32} />
                    </button>
                  )}
                  <p className="mt-4 text-gray-700">
                    {isRecording
                      ? 'Recording... Click to stop'
                      : 'Click to start recording'}
                  </p>
                </div>
              </div>
            )}

            {/* Audio Preview */}
            {audioFile && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-800 mb-2">Input Audio</h3>
                <div className="bg-gray-100 p-4 rounded-lg">
                  <audio
                    ref={audioInputRef}
                    controls
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-800">Processing Settings</h3>
                <button
                  onClick={toggleAdvancedSettings}
                  className="text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                  <Settings size={16} className="mr-1" />
                  {settings.showAdvancedSettings ? 'Hide Advanced' : 'Show Advanced'}
                </button>
              </div>
              
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter Length: {settings.filterLength}
                  </label>
                  <input
                    type="range"
                    name="filterLength"
                    min="128"
                    max="2048"
                    step="128"
                    value={settings.filterLength}
                    onChange={handleSettingChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Higher values provide better echo cancellation but require more processing power.
                  </p>
                </div>
                
                {settings.showAdvancedSettings && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Step Size: {settings.stepSize}
                    </label>
                    <input
                      type="range"
                      name="stepSize"
                      min="0.01"
                      max="0.2"
                      step="0.01"
                      value={settings.stepSize}
                      onChange={handleSettingChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Controls adaptation speed. Lower values are more stable but adapt slower.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Process Button */}
            <div className="mb-6">
              <button
                onClick={processAudio}
                disabled={!audioFile || isProcessing}
                className={`w-full py-3 px-4 rounded-lg font-medium ${
                  !audioFile || isProcessing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Processing... {processingProgress}%
                  </span>
                ) : (
                  'Process Audio'
                )}
              </button>
            </div>

            {/* Processed Audio */}
            {processedAudio && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-800 mb-2">Processed Audio</h3>
                <div className="bg-gray-100 p-4 rounded-lg">
                  <audio
                    ref={audioOutputRef}
                    controls
                    className="w-full"
                  />
                  <div className="mt-4 flex justify-center space-x-4">
                    <button
                      onClick={togglePlayback}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center"
                    >
                      {isPlaying ? (
                        <>
                          <StopCircle size={16} className="mr-2" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play size={16} className="mr-2" />
                          Play
                        </>
                      )}
                    </button>
                    <button
                      onClick={downloadProcessedAudio}
                      className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center"
                    >
                      <Download size={16} className="mr-2" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Info Section */}
        <section className="max-w-4xl mx-auto mt-12 bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Info className="text-indigo-600 mr-2" size={24} />
              <h2 className="text-xl font-bold text-gray-800">About This Project</h2>
            </div>
            <div className="prose text-gray-600">
              <p>
                This RTV Echo Cancellation project uses advanced signal processing techniques to remove noise and echo from audio recordings. The processing is powered by WebAssembly (WASM) for high-performance computation.
              </p>
              <h3 className="text-lg font-medium text-gray-800 mt-4">Key Features:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Upload audio files or record live audio</li>
                <li>Process audio using the optimized NLMS algorithm for adaptive filtering</li>
                <li>Real-time performance with WebAssembly</li>
                <li>Adjustable processing parameters</li>
                <li>Download processed audio files</li>
              </ul>
              <p className="mt-4">
                The project leverages Web Workers to handle computations without blocking the UI, ensuring a smooth user experience even during intensive processing tasks.
              </p>
              <h3 className="text-lg font-medium text-gray-800 mt-4">How It Works:</h3>
              <p>
                The NLMS algorithm adaptively adjusts filter coefficients to minimize the difference between the desired signal and the filtered output. This makes it particularly effective for echo cancellation and noise reduction in varying acoustic environments.
              </p>
              <p className="mt-2">
                For best results with echo cancellation, use audio with clear echo patterns. The algorithm works by identifying and removing repetitive patterns in the audio signal.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-12 text-center text-gray-600 text-sm">
          <p>© 2025 RTV Echo Cancellation Project. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;