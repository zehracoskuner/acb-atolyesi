import { TERMS_VERSION } from "../lib/terms";
import "../styles/TermsAcceptance.css";

export default function LegalDraftNotice() {
  return <aside className="legal-draft-note" aria-label="Taslak ve kaynak bilgisi">
    <p><strong>Hukuk incelemesi bekleyen taslak ek — 16 Eylül 2026</strong></p>
    <p>Sürüm: {TERMS_VERSION}. Eser sahipliği ve izinsiz kullanım eki nihai hukuk onayı almamıştır. Mevcut metin korunmuştur; ekin mevcut lisans ve kabul hükümleriyle birlikte değerlendirilmesi gerekir.</p>
    <p>Resmî kaynaklar (erişim: 16 Eylül 2026):{" "}
      <a href="https://telifhaklari.ktb.gov.tr/TR-332375/telif-hakki-nedir.html" target="_blank" rel="noopener noreferrer">Kültür ve Turizm Bakanlığı — Telif Hakkı Nedir?</a>{" · "}
      <a href="https://telifhaklari.ktb.gov.tr/TR-332372/telif-hakki-ihlali-halinde-ne-yapilabilir.html" target="_blank" rel="noopener noreferrer">Telif Hakkı İhlali Halinde Ne Yapılabilir?</a>{" · "}
      <a href="https://telifhaklari.ktb.gov.tr/TR-332443/kanunlar.html" target="_blank" rel="noopener noreferrer">5846 sayılı Kanun — resmî mevzuat dizini</a>
    </p>
  </aside>;
}
