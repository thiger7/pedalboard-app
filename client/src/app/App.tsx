import { useEffect, useState } from 'react';
import { AudioPlayer } from '../components/AudioPlayer';
import { EffectorBoard } from '../components/EffectorBoard';
import { FileSelector } from '../components/FileSelector';
import {
  useAppMode,
  useAudioProcessor,
  useInputFiles,
  useS3Upload,
} from '../hooks/useAudioProcessor';
import type { Effect } from '../types/effects';
import { createInitialEffects, effectsToChain } from '../utils/effectsMapping';
import './App.css';

function App() {
  const [effects, setEffects] = useState<Effect[]>(createInitialEffects);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [inputAudioUrl, setInputAudioUrl] = useState<string | null>(null);
  const [outputAudioUrl, setOutputAudioUrl] = useState<string | null>(null);

  const { mode, isLoading: isModeLoading } = useAppMode();
  const { files, isLoading: isLoadingFiles, fetchFiles } = useInputFiles();
  const {
    processAudio,
    processS3Audio,
    getNormalizedAudioUrl,
    isProcessing,
    error,
  } = useAudioProcessor();
  const { uploadFile, isUploading, uploadedKey, uploadError } = useS3Upload();

  useEffect(() => {
    if (mode === 'local') {
      fetchFiles();
    }
  }, [mode, fetchFiles]);

  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name);
    await uploadFile(file);
  };

  const handleProcess = async () => {
    const enabledEffects = effects.filter((e) => e.enabled);
    if (enabledEffects.length === 0) {
      alert('Please enable at least one effect');
      return;
    }

    if (mode === 's3') {
      // S3 mode
      if (!uploadedKey) {
        alert('Please upload an audio file first');
        return;
      }

      const result = await processS3Audio(uploadedKey, effectsToChain(effects));
      if (result) {
        setInputAudioUrl(result.input_normalized_url);
        setOutputAudioUrl(result.output_normalized_url);
      }
    } else {
      // Local mode
      if (!selectedFile) {
        alert('Please select an input file');
        return;
      }

      const result = await processAudio({
        input_file: selectedFile,
        effect_chain: effectsToChain(effects),
      });

      if (result) {
        setInputAudioUrl(getNormalizedAudioUrl(result.input_normalized));
        setOutputAudioUrl(getNormalizedAudioUrl(result.output_normalized));
      }
    }
  };

  const isReady =
    mode === 's3' ? !!uploadedKey && !isUploading : !!selectedFile;

  if (isModeLoading) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pedalboard Demo</h1>
        <p>Guitar Effect Simulator</p>
      </header>

      <main className="app-main">
        <section className="input-section">
          {mode === 's3' ? (
            <FileSelector
              mode="s3"
              onFileSelect={handleFileUpload}
              uploadedFileName={uploadedFileName}
              isUploading={isUploading}
            />
          ) : (
            <FileSelector
              mode="local"
              files={files}
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
              isLoading={isLoadingFiles}
            />
          )}
          {uploadError && <p className="error-message">{uploadError}</p>}
        </section>

        <section className="effects-section">
          <EffectorBoard effects={effects} onEffectsChange={setEffects} />
        </section>

        <section className="process-section">
          <button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing || !isReady}
            className="process-button"
          >
            {isProcessing ? 'Processing...' : 'Process Audio'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </section>

        <section className="audio-section">
          <AudioPlayer label="Input" audioUrl={inputAudioUrl} color="#3b82f6" />
          <AudioPlayer
            label="Output"
            audioUrl={outputAudioUrl}
            color="#10b981"
          />
        </section>
      </main>
    </div>
  );
}

export default App;
