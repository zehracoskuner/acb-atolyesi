// src/components/Write/AIStrip.jsx
import React from "react";

export default function AIStrip({
  stripOpen,
  setStripOpen,
  stripTab,
  setStripTab,
  loadingAI,
  text,
  review,
  handleReview,
  chatInput,
  setChatInput,
  chat,
  sendChat,
  chatBoxRef,
  constraint,
  pickConstraint,
}) {
  function handleTab(t) {
    if (stripTab === t && stripOpen) {
      setStripOpen(false);
      return;
    }
    setStripTab(t);
    setStripOpen(true);
  }

  return (
    <div className={`write-ai-strip ${stripOpen ? "open" : ""}`}>
      {/* İkon Çubuğu */}
      <div className="strip-icons">
        <button
          className={`strip-icon-btn ${stripTab === "review" && stripOpen ? "active" : ""}`}
          data-tip="AI Yorum"
          onClick={() => handleTab("review")}
        >
          🤖
        </button>
        <button
          className={`strip-icon-btn ${stripTab === "chat" && stripOpen ? "active" : ""}`}
          data-tip="AI Sohbet"
          onClick={() => handleTab("chat")}
        >
          💬
        </button>
        <button
          className={`strip-icon-btn ${stripTab === "ilham" && stripOpen ? "active" : ""}`}
          data-tip="İlham"
          onClick={() => handleTab("ilham")}
        >
          ✨
        </button>
      </div>

      {/* Panel İçeriği */}
      <div className="strip-panel">
        <div className="strip-panel-head">
          <span className="strip-panel-title">
            {stripTab === "review" ? "AI Yorum" : stripTab === "chat" ? "AI Sohbet" : "İlham"}
          </span>
          <button className="strip-panel-close" onClick={() => setStripOpen(false)}>
            ✕
          </button>
        </div>

        {/* Sekme: AI Yorum */}
        {stripTab === "review" && (
          <>
            <button
              className="strip-ai-action"
              onClick={handleReview}
              disabled={loadingAI || !text?.trim()}
            >
              <span className="action-icon">🔍</span>
              {loadingAI ? "Analiz ediyorum…" : "Metni Analiz Et"}
            </button>
            <div className="strip-review-scroll">
              {loadingAI && <p className="strip-muted">Analiz ediyorum…</p>}
              {!loadingAI && !review && (
                <p className="strip-muted">
                  Metni yazdıktan sonra "Analiz Et" butonuna bas. Yapı, ritim ve show-don't-tell üzerine yorum gelecek.
                </p>
              )}
              {!loadingAI && review && (
                <>
                  <p className="strip-review-text">{review.analysis}</p>
                  {review.closingNote && <p className="strip-review-closing">— {review.closingNote}</p>}
                </>
              )}
            </div>
          </>
        )}

        {/* Sekme: AI Sohbet */}
        {stripTab === "chat" && (
          <div className="strip-chat-panel" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="strip-chat-thread" ref={chatBoxRef}>
              {chat?.length === 0 && (
                <p className="schat-empty">AI ile metnin hakkında sohbet edebilirsin. Sahne, karakter, diyalog — her şey.</p>
              )}
              {chat?.map((m, i) => (
                <div key={i} className={`schat-bubble ${m.role === "user" ? "user" : ""}`}>
                  <span className="schat-label">{m.role === "user" ? "Sen" : "AI"}</span>
                  <p>{m.content}</p>
                </div>
              ))}
            </div>
            <div className="strip-chat-input-row">
              <input
                className="strip-chat-input"
                placeholder="Sor…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatInput.trim()) sendChat();
                }}
              />
              <button
                className="strip-chat-send"
                onClick={sendChat}
                disabled={loadingAI || !chatInput.trim()}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Sekme: İlham */}
        {stripTab === "ilham" && (
          <div className="strip-ilham">
            <p className="ilham-tip">Yaratıcılık bir kas gibidir. Zorlayarak büyür.</p>
            <div className="constraint-section">
              <button className="constraint-roll-btn" onClick={pickConstraint}>
                <span>🎲</span> Rastgele Kısıtlama
              </button>
              {constraint && (
                <div className="constraint-card">
                  <span className="constraint-quote">"</span>
                  <p>{constraint}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}