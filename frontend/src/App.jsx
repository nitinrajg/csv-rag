import { useState, useEffect } from "react";
import Upload from "./Upload";
import Chat from "./Chat";

/**
 * App — Root controller that toggles between Upload and Chat screens.
 * 
 * Manages three pieces of state:
 * - sessionId: the backend session key (null = show Upload)
 * - fileInfo: metadata about the uploaded CSV (name, size) to display in sidebar
 * - transitioning: drives a short exit-animation before switching screens
 * 
 * The `handleUploadSuccess` callback stores the session + file info,
 * then triggers a 350ms exit animation before revealing the Chat screen.
 * `handleNewFile` does the reverse — animates out Chat, resets to Upload.
 */
function App() {
  const [sessionId, setSessionId] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [screenReady, setScreenReady] = useState(true);

  const handleUploadSuccess = (id, info) => {
    setTransitioning(true);
    setTimeout(() => {
      setSessionId(id);
      setFileInfo(info);
      setTransitioning(false);
      setScreenReady(true);
    }, 350);
  };

  const handleNewFile = () => {
    setTransitioning(true);
    setTimeout(() => {
      setSessionId(null);
      setFileInfo(null);
      setTransitioning(false);
      setScreenReady(true);
    }, 350);
  };

  const screenClass = transitioning ? "screen-exit" : "screen-enter";

  return (
    <div className="app">
      {/* Ambient background orbs — always visible behind content */}
      <div className="ambient-bg" />

      <div key={sessionId ? "chat" : "upload"} className={screenClass}>
        {sessionId ? (
          <Chat
            sessionId={sessionId}
            fileInfo={fileInfo}
            onNewFile={handleNewFile}
          />
        ) : (
          <Upload onUploadSuccess={handleUploadSuccess} />
        )}
      </div>
    </div>
  );
}

export default App;
