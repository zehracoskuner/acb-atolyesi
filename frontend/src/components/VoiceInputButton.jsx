import { useEffect, useRef } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

/**
 * Sesle yazma butonu (speech-to-text).
 *
 * Props:
 *   onResult(text)  -> dinleme sırasında biriken transcript'in YALNIZCA yeni
 *                      kısmını (delta) parent'a iletir. Parent bunu mevcut
 *                      değere append eder: setContent(c => c + " " + text)
 *   lang            -> tanıma dili (varsayılan "tr-TR")
 *   className       -> dış stil ekleme noktası (opsiyonel)
 *
 * Tarayıcı desteklemiyorsa (örn. Firefox) buton hiç render edilmez — sessiz fallback.
 */
export default function VoiceInputButton({ onResult, lang = "tr-TR", className = "" }) {
  const {
    interimTranscript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // Parent'a en son gönderdiğimiz finalTranscript uzunluğunu takip et ki
  // continuous modda büyüyen transcript'i tekrar tekrar göndermeyelim.
  // Sadece finalTranscript kullanılıyor: interimTranscript tanıma motoru
  // tarafından geriye dönük revize edilebiliyor (örn. "sahn" -> "sahnede"),
  // bu da kelimelerin ortasından bölünmesine yol açıyordu.
  const lastSentRef = useRef("");

  useEffect(() => {
    if (!listening) return;
    if (finalTranscript && finalTranscript !== lastSentRef.current) {
      const delta = finalTranscript.slice(lastSentRef.current.length);
      if (delta.trim()) {
        onResult?.(delta.trim());
        lastSentRef.current = finalTranscript;
      }
    }
  }, [finalTranscript, listening, onResult]);

  // Component unmount olursa (sayfa/drawer kapanması) dinlemeyi durdur.
  useEffect(() => {
    return () => {
      SpeechRecognition.stopListening();
    };
  }, []);

  // react-speech-recognition "error" event'ini (network, no-speech,
  // language-not-supported vb.) tamamen yutuyor — continuous modda
  // "network" hatası alınca sessizce sürekli yeniden başlıyor ("dinliyor"
  // görünür ama hiç transcript gelmez). Native event'i kendimiz dinleyip
  // kullanıcıya görünür hale getiriyoruz.
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) return;
    const recognition = SpeechRecognition.getRecognition();
    if (!recognition) return;

    const handleError = (e) => {
      console.error("Konuşma tanıma hatası:", e.error, e.message);
      if (e.error === "network") {
        alert("Sesle yazma için konuşma tanıma servisine erişilemiyor (ağ/internet hatası). Bağlantını kontrol edip tekrar dene.");
        SpeechRecognition.stopListening();
      } else if (e.error === "language-not-supported") {
        alert("Türkçe (tr-TR) konuşma tanıma bu tarayıcıda desteklenmiyor.");
        SpeechRecognition.stopListening();
      } else if (e.error === "no-speech") {
        console.warn("Ses algılanmadı.");
      } else if (e.error === "not-allowed" || e.error === "audio-capture") {
        alert("Sesle yazma için mikrofon izni gerekiyor. Lütfen tarayıcı ayarlarından bu sitenin mikrofona erişimine izin ver.");
        SpeechRecognition.stopListening();
      }
    };

    recognition.addEventListener("error", handleError);
    return () => recognition.removeEventListener("error", handleError);
  }, [browserSupportsSpeechRecognition]);

  if (!browserSupportsSpeechRecognition) return null;

  const toggle = () => {
    if (listening) {
      SpeechRecognition.stopListening();
      return;
    }

    resetTranscript();
    lastSentRef.current = "";
    SpeechRecognition.startListening({ continuous: true, language: lang });
  };

  return (
    <span className="voice-input-wrap">
      <button
        type="button"
        onClick={toggle}
        className={`voice-input-btn ${listening ? "is-listening" : ""} ${className}`}
        title={listening ? "Dinlemeyi durdur" : "Sesle yaz"}
        aria-label={listening ? "Dinlemeyi durdur" : "Sesle yaz"}
        aria-pressed={listening}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z"
          />
          <path
            fill="currentColor"
            d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.08A7 7 0 0 0 19 11z"
          />
        </svg>
      </button>

      {listening && (
        <span className="voice-input-live">
          {interimTranscript ? interimTranscript : "dinleniyor…"}
        </span>
      )}

      <style>{`
        .voice-input-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .voice-input-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: 1px solid var(--border, #e0d7c4);
          border-radius: 8px;
          background: var(--surface, #fffdf7);
          color: var(--text-muted, #8a7d63);
          cursor: pointer;
          transition: color .15s ease, border-color .15s ease, background .15s ease;
          flex: 0 0 auto;
        }
        .voice-input-btn:hover {
          color: var(--accent, #c08a2e);
          border-color: var(--accent, #c08a2e);
        }
        .voice-input-btn.is-listening {
          color: #fff;
          background: var(--accent, #c08a2e);
          border-color: var(--accent, #c08a2e);
          animation: voice-pulse 1.2s ease-in-out infinite;
        }
        @keyframes voice-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(192,138,46,.45); }
          50%      { box-shadow: 0 0 0 6px rgba(192,138,46,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .voice-input-btn.is-listening { animation: none; }
        }
        .voice-input-live {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 6px;
          max-width: 240px;
          background: #1c1917;
          color: #fff;
          font-size: 0.75rem;
          line-height: 1.4;
          padding: 6px 10px;
          border-radius: 6px;
          white-space: normal;
          z-index: 50;
          opacity: 0.92;
          pointer-events: none;
        }
      `}</style>
    </span>
  );
}