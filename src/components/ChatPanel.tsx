import React, { useEffect, useRef, useState } from "react";
import { useOptionalAuth } from "../context/AuthContext";
import useChat from "../hooks/useChat";

export function ChatPanel() {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const isReady = auth?.isReady ?? true;
  const { messages, sendMessage, connected } = useChat("general");
  const [text, setText] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText("");
  };

  if (!isReady) return null;

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, width: 320, maxHeight: isMinimized ? 64 : 400, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", borderRadius: 8, background: "white", display: "flex", flexDirection: "column", zIndex: 1000, overflow: "hidden" }}>
      <div style={{ padding: 8, borderBottom: isMinimized ? "none" : "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>Chat</strong>
          <span style={{ fontSize: 12, color: connected ? "green" : "gray" }}>{connected ? "online" : "offline"}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized((current) => !current)}
          aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
          title={isMinimized ? "Expand chat" : "Minimize chat"}
          style={{ padding: "4px 8px", borderRadius: 4, background: "#f3f3f3", color: "#111", border: "1px solid #ddd", fontSize: 12 }}
        >
          {isMinimized ? "+" : "-"}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div ref={listRef} style={{ padding: 8, overflowY: "auto", flex: 1 }}>
            {!user ? (
              <div style={{ color: "#666" }}>Please log in to chat</div>
            ) : (
              messages.map((m) => (
                <div key={m.messageId} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "#333", fontWeight: 600 }}>{m.username} <span style={{ fontWeight: 400, color: "#888", marginLeft: 6 }}>{new Date(m.createdAt).toLocaleTimeString()}</span></div>
                  <div style={{ fontSize: 14 }}>{m.content}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: 8, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
            <input value={text} onChange={(e) => setText(e.target.value)} disabled={!user} onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }} style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ddd" }} />
            <button onClick={handleSend} disabled={!user || !text.trim()} style={{ padding: "8px 12px", borderRadius: 4, background: "#111", color: "white", border: "none" }}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}

export default ChatPanel;
