import { useRef, useState } from 'react';
import { AudioPlayer, type AudioPlayerHandle } from '../components/AudioPlayer';
import { EffectorBoard } from '../components/EffectorBoard';
import { FileSelector } from '../components/FileSelector';
import { HistoryPanel } from '../components/HistoryPanel';
import {
  useAppMode,
  useAudioProcessor,
  useS3Upload,
} from '../hooks/useAudioProcessor';
import { useJobHistory } from '../hooks/useJobHistory';
import type { Effect, JobResponse } from '../types/effects';
import { createInitialEffects, effectsToChain } from '../utils/effectsMapping';
import './App.css';

function App() {
  const [effects, setEffects] = useState<Effect[]>(createInitialEffects);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [inputAudioUrl, setInputAudioUrl] = useState<string | null>(null);
  const [outputAudioUrl, setOutputAudioUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const inputPlayerRef = useRef<AudioPlayerHandle>(null);
  const outputPlayerRef = useRef<AudioPlayerHandle>(null);

  const { mode, files, isLoading: isModeLoading } = useAppMode();
  const {
    processAudio,
    processS3Audio,
    processS3AudioAsync,
    getAudioUrl,
    getNormalizedAudioUrl,
    isProcessing,
    error,
  } = useAudioProcessor();
  const { uploadFile, isUploading, uploadedKey, uploadError } = useS3Upload();
  const {
    jobs,
    isLoading: isHistoryLoading,
    recentlyCompletedIds,
    addJobId,
    clearHistory,
    clearHighlight,
    fetchJobs,
    pollJobUntilComplete,
  } = useJobHistory();
  const historySectionRef = useRef<HTMLElement>(null);

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
      // S3 mode - 非同期処理
      if (!uploadedKey) {
        alert('Please upload an audio file first');
        return;
      }

      // 非同期処理を試みる
      const asyncResult = await processS3AudioAsync(
        uploadedKey,
        effectsToChain(effects),
        uploadedFileName ?? undefined,
      );

      if (asyncResult) {
        // ジョブIDを履歴に追加して即座に表示
        addJobId(asyncResult.job_id);
        fetchJobs();

        // バックグラウンドでポーリング（UIはブロックしない、ボタンはすぐに有効化）
        pollJobUntilComplete(asyncResult.job_id).then(() => {
          // 完了時に履歴を更新
          fetchJobs();
          // History セクションへスクロール
          historySectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
      } else {
        // 非同期が利用できない場合は同期処理にフォールバック
        const result = await processS3Audio(
          uploadedKey,
          effectsToChain(effects),
          uploadedFileName ?? undefined,
        );
        if (result) {
          setInputAudioUrl(result.input_normalized_url);
          setOutputAudioUrl(result.output_normalized_url);
          setDownloadUrl(result.download_url);
          setOutputFileName(uploadedFileName);
          setSelectedJobId(null);
        }
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
        setDownloadUrl(getAudioUrl(result.output_file));
        setOutputFileName(selectedFile);
        setSelectedJobId(null);
      }
    }
  };

  const handleSelectJob = (job: JobResponse) => {
    if (job.status === 'completed') {
      const newInputUrl = job.input_normalized_url ?? null;
      const newOutputUrl = job.output_normalized_url ?? null;

      // 同じ音声なら何もしない
      if (newInputUrl === inputAudioUrl && newOutputUrl === outputAudioUrl) {
        return;
      }

      // 再生中のプレイヤーを停止
      inputPlayerRef.current?.pause();
      outputPlayerRef.current?.pause();
      setInputAudioUrl(newInputUrl);
      setOutputAudioUrl(newOutputUrl);
      setDownloadUrl(job.download_url ?? null);
      setOutputFileName(job.original_filename ?? null);
      setSelectedJobId(job.job_id);
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
        <h1>Pedalboard</h1>
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
              isLoading={isModeLoading}
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
            {isProcessing ? 'Submitting...' : 'Apply Effects'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </section>

        <section className="audio-section-container">
          <div className="audio-section-header">
            <h2>Waveform</h2>
          </div>
          <div className="audio-section">
            <AudioPlayer
              ref={inputPlayerRef}
              label="Input"
              audioUrl={inputAudioUrl}
              color="#3b82f6"
              onPlay={() => outputPlayerRef.current?.pause()}
            />
            <AudioPlayer
              ref={outputPlayerRef}
              label="Output"
              audioUrl={outputAudioUrl}
              color="#10b981"
              onPlay={() => inputPlayerRef.current?.pause()}
            />
          </div>
        </section>

        {downloadUrl && (
          <section className="output-section">
            <div className="file-selector">
              <span className="file-selector-label">Output File:</span>
              <a href={downloadUrl} download className="download-link">
                Download
              </a>
              <span className="output-filename">{outputFileName ?? ''}</span>
            </div>
          </section>
        )}

        {mode === 's3' && jobs.length > 0 && (
          <section
            className="history-section-container"
            ref={historySectionRef}
          >
            <div className="history-section-header">
              <h2>History</h2>
            </div>
            <HistoryPanel
              jobs={jobs}
              isLoading={isHistoryLoading}
              recentlyCompletedIds={recentlyCompletedIds}
              selectedJobId={selectedJobId}
              onRefresh={fetchJobs}
              onClear={clearHistory}
              onSelectJob={handleSelectJob}
              onClearHighlight={clearHighlight}
            />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
