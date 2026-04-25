import { useState, useRef, useEffect } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

/**
 * Chat — The main conversation interface with sidebar, streaming, and markdown.
 *
 * Layout: [Sidebar | Main Chat Area]
 * - Sidebar shows branding, file stats, and "Upload New File" button
 * - Main area has header, scrollable messages, and input bar
 *
 * Key features preserved from original:
 * - Exact same streaming logic (ReadableStream + TextDecoder)
 * - Same API contract (POST /chat with session_id + message)
 * - Same Enter-to-send, Shift+Enter for newline
 *
 * New features:
 * - Markdown rendering via MarkdownRenderer (replaces <pre>)
 * - Copy-to-clipboard on each assistant message
 * - Relative timestamps on every message
 * - Sidebar with dataset stats (file name, size)
 * - Mobile-responsive slide-out sidebar
 */

/** Returns a human-friendly relative time string like "just now" or "2m ago" */
function relativeTime(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function Chat({ sessionId, fileInfo, onNewFile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setTick] = useState(0); // force re-render for relative times
  const messagesEndRef = useRef(null);

  // Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update relative timestamps every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg, time: new Date() },
    ]);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMsg,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Chat request failed");
      }

      // ── Streaming response handling (preserved exactly) ──
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      // Add empty assistant message placeholder
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", time: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;

        // Update the last message (assistant) with accumulated text
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantText,
            time: updated[updated.length - 1].time,
          };
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message}`,
          time: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      // Briefly show "copied" state via a data attribute trick
      const btn = document.getElementById(`copy-${idx}`);
      if (btn) {
        btn.classList.add("copied");
        btn.textContent = "✓ Copied";
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.textContent = "Copy";
        }, 1500);
      }
    } catch { /* clipboard may fail in insecure contexts */ }
  };

  return (
    <div className="chat-layout">
      {/* ── Mobile sidebar overlay ── */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">📊</div>
          <h2>CSV Analyst</h2>
        </div>

        {/* Dataset stats */}
        {fileInfo && (
          <div className="sidebar-section">
            <p className="sidebar-section-title">Dataset</p>
            <div className="stat-cards">
              <div className="stat-card">
                <span className="stat-card-icon">📄</span>
                <div className="stat-card-info">
                  <span className="stat-card-label">File</span>
                  <span className="stat-card-value">{fileInfo.name}</span>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-card-icon">📦</span>
                <div className="stat-card-info">
                  <span className="stat-card-label">Size</span>
                  <span className="stat-card-value">
                    {fileInfo.size < 1024 * 1024
                      ? `${(fileInfo.size / 1024).toFixed(1)} KB`
                      : `${(fileInfo.size / (1024 * 1024)).toFixed(2)} MB`}
                  </span>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-card-icon">💬</span>
                <div className="stat-card-info">
                  <span className="stat-card-label">Messages</span>
                  <span className="stat-card-value">{messages.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload New File button pinned to bottom */}
        <button className="sidebar-new-btn" onClick={onNewFile}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Upload New File
        </button>
      </aside>

      {/* ── Main chat area ── */}
      <main className="chat-main">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <h2>Analysis</h2>
            <span className="session-badge">● Live</span>
          </div>
        </div>

        {/* Messages area */}
        <div className="messages-area">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">✨</div>
              <h3>Your data is ready</h3>
              <p>
                Ask anything about your dataset — trends, outliers,
                distributions, or specific column stats.
              </p>
              <div className="suggestions">
                <button onClick={() => setInput("Summarize the dataset")}>
                  Summarize the dataset
                </button>
                <button onClick={() => setInput("What are the key trends?")}>
                  What are the key trends?
                </button>
                <button onClick={() => setInput("Show column statistics")}>
                  Show column statistics
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === "user" ? "👤" : "🤖"}
              </div>
              <div className="message-bubble">
                <div className="message-content">
                  {msg.role === "assistant" ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
                <div className="message-meta">
                  <span className="message-time">
                    {msg.time ? relativeTime(msg.time) : ""}
                  </span>
                  {msg.role === "assistant" && msg.content && (
                    <button
                      id={`copy-${i}`}
                      className="copy-btn"
                      onClick={() => copyToClipboard(msg.content, i)}
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="message assistant">
              <div className="message-avatar">🤖</div>
              <div className="message-bubble">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="chat-input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data…"
            rows={1}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            {loading ? (
              <span className="spinner-small"></span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
