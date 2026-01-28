interface FileSelectorProps {
  files: string[];
  selectedFile: string;
  onSelect: (file: string) => void;
  isLoading: boolean;
}

export function FileSelector({
  files,
  selectedFile,
  onSelect,
  isLoading,
}: FileSelectorProps) {
  if (isLoading) {
    return (
      <div className="file-selector">
        <span>Input File:</span>
        <span>Loading...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="file-selector">
        <span>Input File:</span>
        <span className="no-files">No audio files found in audio/input/</span>
      </div>
    );
  }

  return (
    <div className="file-selector">
      <label htmlFor="input-file">Input File:</label>
      <select
        id="input-file"
        value={selectedFile}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">Select a file...</option>
        {files.map((file) => (
          <option key={file} value={file}>
            {file}
          </option>
        ))}
      </select>
    </div>
  );
}
