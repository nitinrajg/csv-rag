import { useState } from "react";

/**
 * Upload — The landing screen where users drag/drop or browse for a CSV file.
 *
 * Design decisions:
 * - Glassmorphism card with backdrop-blur sits on top of ambient orbs
 * - Skeleton progress bar replaces the old spinner during upload,
 *   giving a sense of real progress even though the fetch is opaque
 * - The SVG icon uses the `iconPulse` CSS animation for a floating effect
 * - File validation happens both on drop and on input change
 * - On success, we pass both session_id AND file metadata (name, size)
 *   up to App so the Chat sidebar can show dataset info
 */
export default function Upload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Upload failed");
      }

      const data = await res.json();
      onUploadSuccess(data.session_id, {
        name: file.name,
        size: file.size,
      });
    } catch (err) {
      setError(err.message);
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      setFile(droppedFile);
      setError("");
    } else {
      setError("Only .csv files are accepted.");
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-card">
        {/* Floating upload icon */}
        <div className="upload-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <h1 className="upload-title">
          CSV Analyst<span className="accent-dot">.</span>
        </h1>
        <p className="upload-subtitle">
          Drop your dataset and let AI surface the insights hiding in your data
        </p>

        {/* Show skeleton loader during upload, otherwise show drop zone + button */}
        {uploading ? (
          <div style={{ padding: "20px 0" }}>
            <div className="skeleton-bar">
              <div className="skeleton-bar-inner" />
            </div>
            <p className="skeleton-text">Parsing columns & building context…</p>
          </div>
        ) : (
          <>
            <div
              className={`drop-zone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("csv-input").click()}
            >
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setError("");
                  }
                }}
              />
              {file ? (
                <div className="file-info">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <p>Drag & drop a <strong>.csv</strong> file here, or click to browse</p>
              )}
            </div>

            <button
              className="upload-btn"
              onClick={handleUpload}
              disabled={!file}
            >
              Upload & Analyze
            </button>
          </>
        )}

        {error && <p className="error-msg">{error}</p>}
      </div>
    </div>
  );
}
