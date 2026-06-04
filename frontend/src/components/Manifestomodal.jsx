import { useState, useEffect } from "react";

const ManifestoModal = ({ isOpen, onClose, onKesfet }) => {
  const [visible, setVisible] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setTimeout(() => setContentVisible(true), 50);
    } else {
      setContentVisible(false);
      setTimeout(() => setVisible(false), 400);
    }
  }, [isOpen]);

  if (!visible) return null;

  const handleKesfet = () => {
    onClose();
    if (onKesfet) onKesfet();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        backgroundColor: contentVisible ? "rgba(45, 35, 25, 0.45)" : "rgba(45, 35, 25, 0)",
        backdropFilter: contentVisible ? "blur(4px)" : "blur(0px)",
        transition: "background-color 0.4s ease, backdrop-filter 0.4s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, #faf8f3 0%, #f5f0e8 60%, #ede8dc 100%)",
          border: "1px solid #d4c9b0",
          borderRadius: "4px",
          maxWidth: "580px",
          width: "100%",
          padding: "3rem 3.5rem 2.5rem",
          position: "relative",
          boxShadow: "0 8px 40px rgba(80, 60, 30, 0.18), 0 2px 8px rgba(80, 60, 30, 0.08)",
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.98)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
      >
        {/* Dekoratif üst çizgi */}
        <div style={{
          position: "absolute",
          top: 0,
          left: "3.5rem",
          right: "3.5rem",
          height: "2px",
          background: "linear-gradient(90deg, transparent, #b8a882, transparent)",
        }} />

        {/* Kapat butonu */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.2rem",
            right: "1.4rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#9a8c78",
            fontSize: "1.1rem",
            lineHeight: 1,
            padding: "0.3rem 0.5rem",
            borderRadius: "2px",
            transition: "color 0.2s ease",
            fontFamily: "Georgia, serif",
          }}
          onMouseEnter={e => e.target.style.color = "#5c4a2a"}
          onMouseLeave={e => e.target.style.color = "#9a8c78"}
        >
          ✕
        </button>

        {/* Başlık */}
        <div style={{
          fontFamily: "'Cormorant Garamond', 'DM Serif Display', Georgia, serif",
          fontSize: "0.7rem",
          letterSpacing: "0.25em",
          color: "#9a8c78",
          textTransform: "uppercase",
          marginBottom: "1.8rem",
        }}>
          ACB Atölyesi · Manifesto
        </div>

        {/* Birinci paragraf — şiirsel giriş */}
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: "1.08rem",
          lineHeight: "1.85",
          color: "#4a3f2f",
          marginBottom: "1.6rem",
          fontStyle: "italic",
          borderLeft: "2px solid #c8b99a",
          paddingLeft: "1.2rem",
        }}>
          Yazmak bazen yağmur gibidir, susup içimizde biriktirdiğimiz onca duygunun 
          kendiliğinden dışa vurumudur. Bizi dengelemesine rağmen dengelenemeyen kelime 
          topluluklarıdır. Kontrolsüzce zihnimizin döktüğü yağmur damlaları misali, 
          toprağımızı, ruhumuzu besler, bizi tedavi eder. Yazmak birçok tanımla 
          anlatılabilecekken en güzelini aramaya gerek yoktur. Çünkü yazmak en yalın 
          haliyle kendi başına bahar yağmuru kadar güzeldir.
        </p>

        {/* İkinci paragraf — platform hikayesi */}
        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: "1.05rem",
          lineHeight: "1.85",
          color: "#5c4e3a",
          marginBottom: "1.4rem",
        }}>
          ACB Atölyesi henüz alfabeyi bile doğru yazamayan (!) bir yazılımcının fikriyle 
          doğdu. Burası mükemmel hikayelerin değil, kendini bu konuda geliştirmek isteyen 
          ve okumayı seven kişiler için oluşturulmuş bir topluluk. Bir acemi yazarlar birliği.
        </p>

        <p style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: "1.05rem",
          lineHeight: "1.85",
          color: "#5c4e3a",
          marginBottom: "2rem",
        }}>
          İster keşfederek oku, ister sadece senin zihninde yaşayan evrenlerin taslaklarını 
          atölyende inşa etmeye başla. Ama en nihayetinde sonsuz ihtimalle dolu beyaz kağıda 
          sana özgü hikayeni yaz. Çünkü eminim ki sadece senin zihninde durması, okumayı 
          severler için haksızlık 🙂
        </p>

        {/* İmza */}
        <div style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: "0.95rem",
          color: "#8a7a62",
          fontStyle: "italic",
          marginBottom: "2.5rem",
          paddingTop: "0.5rem",
          borderTop: "1px solid #ddd4bc",
        }}>
          Yazı atölyemize ve topluluğumuza hoş geldin, iyi ki geldin.
          <br />
          <span style={{ fontSize: "0.88rem", letterSpacing: "0.05em" }}>— Geliştirici, Vito.</span>
        </div>

        {/* CTA butonu */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={handleKesfet}
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "0.85rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#f5f0e8",
              background: "linear-gradient(135deg, #7a6545 0%, #5c4a2a 100%)",
              border: "none",
              borderRadius: "2px",
              padding: "0.85rem 2.5rem",
              cursor: "pointer",
              transition: "opacity 0.2s ease, transform 0.2s ease",
              boxShadow: "0 2px 12px rgba(80, 60, 30, 0.25)",
            }}
            onMouseEnter={e => {
              e.target.style.opacity = "0.88";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.target.style.opacity = "1";
              e.target.style.transform = "translateY(0)";
            }}
          >
            Atölyeni Keşfet →
          </button>
        </div>

        {/* Dekoratif alt köşe süsü */}
        <div style={{
          position: "absolute",
          bottom: "1.2rem",
          right: "1.5rem",
          fontFamily: "Georgia, serif",
          fontSize: "0.65rem",
          color: "#c8b99a",
          letterSpacing: "0.15em",
        }}>
          ✦
        </div>
      </div>
    </div>
  );
};

export default ManifestoModal;
