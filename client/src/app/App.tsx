import { useEffect, useState } from 'react';
import { AudioPlayer } from '../components/AudioPlayer';
import { EffectorBoard } from '../components/EffectorBoard';
import { FileSelector } from '../components/FileSelector';
import { useAudioProcessor, useInputFiles } from '../hooks/useAudioProcessor';
import type { Effect } from '../types/effects';
import { createInitialEffects, effectsToChain } from '../utils/effectsMapping';
import './App.css';

function App() {
  const [effects, setEffects] = useState<Effect[]>(createInitialEffects);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [inputNormalizedUrl, setInputNormalizedUrl] = useState<string | null>(
    null,
  );
  const [outputNormalizedUrl, setOutputNormalizedUrl] = useState<string | null>(
    null,
  );

  const { files, isLoading: isLoadingFiles, fetchFiles } = useInputFiles();
  const { processAudio, getNormalizedAudioUrl, isProcessing, error } =
    useAudioProcessor();

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleProcess = async () => {
    if (!selectedFile) {
      alert('Please select an input file');
      return;
    }

    const enabledEffects = effects.filter((e) => e.enabled);
    if (enabledEffects.length === 0) {
      alert('Please enable at least one effect');
      return;
    }

    const result = await processAudio({
      input_file: selectedFile,
      effect_chain: effectsToChain(effects),
    });

    if (result) {
      setInputNormalizedUrl(getNormalizedAudioUrl(result.input_normalized));
      setOutputNormalizedUrl(getNormalizedAudioUrl(result.output_normalized));
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pedalboard Demo</h1>
        <p>Guitar Effect Simulator</p>
      </header>

      <main className="app-main">
        <section className="input-section">
          <FileSelector
            files={files}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            isLoading={isLoadingFiles}
          />
        </section>

        <section className="effects-section">
          <EffectorBoard effects={effects} onEffectsChange={setEffects} />
        </section>

        <section className="process-section">
          <button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing || !selectedFile}
            className="process-button"
          >
            {isProcessing ? 'Processing...' : 'Process Audio'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </section>

        <section className="audio-section">
          <AudioPlayer
            label="Input"
            audioUrl={inputNormalizedUrl}
            color="#3b82f6"
          />
          <AudioPlayer
            label="Output"
            audioUrl={outputNormalizedUrl}
            color="#10b981"
          />
        </section>
      </main>
    </div>
  );
}

export default App;
