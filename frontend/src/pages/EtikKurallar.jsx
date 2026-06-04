import { useState } from "react";
import "../styles/LegalPages.css";

const PLEDGES = [
  "Bir yazarın emeğine saygı göstereceğim.",
  "Yorum yaparken yapıcı olmayı seçeceğim.",
  "Eleştirimi esere yönelteceğim, yazara değil.",
  "Bu atölyeyi güvenli bir alan olarak tutmaya katkı sağlayacağım.",
];

export default function EtikKurallar() {
  const [pledged, setPledged] = useState(false);
  const [checkedAll, setCheckedAll] = useState(false);
  const [checks, setChecks] = useState(PLEDGES.map(() => false));

  const toggleCheck = (i) => {
    const next = [...checks];
    next[i] = !next[i];
    setChecks(next);
    setCheckedAll(next.every(Boolean));
  };

  const handlePledge = () => {
    if (checkedAll) setPledged(true);
  };

  const principles = [
    {
      icon: "✍️",
      id: "emek",
      title: "Emeğe Saygı",
      color: "var(--legal-accent-warm)",
      content: `Her metin, bir insanın kırılganlığını kâğıda dökmesidir. Bir eseri okuyup yorum bırakmak, o kırılganlığa ortak olmayı kabul etmektir.

Bir eseri beğenmeseniz dahi yazarın harcadığı zaman, cesaret ve çabayı göz önünde bulundurun. "Bu berbattı" yerine "Şu kısım beni bağlayamadı çünkü..." demek, hem daha doğru hem de çok daha değerlidir.`,
    },
    {
      icon: "🔍",
      id: "yapici-elestiri",
      title: "Yapıcı Eleştiri",
      color: "var(--legal-accent-cool)",
      content: `Yapıcı eleştiri, bir eserin nasıl daha iyi olabileceğine dair somut, dürüst ve saygılı bir bakış açısıdır.

Yapıcı yorumun anatomisi:

→ Gördüğünüzü adlandırın: "Diyaloglar çok mekanik hissettiriyor."
→ Nedenini açıklayın: "Her cümle aynı uzunlukta olduğu için ritim oluşmuyor."
→ Bir kapı aralayın: "Karakterlerin bazen yarım bıraktığı cümleler deneyebilirsiniz."

Eleştiri esere yönelik olmalıdır; yazarın kişiliğine, niyetine veya geçmişine değil.`,
    },
    {
      icon: "🚫",
      id: "yasakli",
      title: "Kabul Edilemez Davranışlar",
      color: "#c0392b",
      content: `Aşağıdaki davranışlar ACB Atölyesi'nde kesinlikle kabul edilmez ve hesap kapatmaya kadar yaptırımla sonuçlanır:

• Bir eseri veya yazarı aşağılayıcı, küçük düşürücü yorumlar
• Kişisel saldırı, hakaret veya taciz
• Nefret söylemi — kimseye dil, din, cinsiyet, köken veya kimliği nedeniyle saldırılamaz
• Başka bir kullanıcıyı Platform dışından takip etme veya tehdit etme
• Spam yorum, koordineli taciz veya organize baskı

"Ama dürüst davranıyordum" savunması kabul görmez. Dürüstlük ile nezaket birbirini dışlamaz.`,
    },
    {
      icon: "🤝",
      id: "topluluk",
      title: "Topluluk Ruhu",
      color: "var(--legal-accent-warm)",
      content: `Atölye, birbirinden öğrenen yazarların topluluğudur. Yeni başlayan bir yazar ile yıllardır yazan biri aynı masayı paylaşır. Bu zenginliktir.

Farklı türlere, anlatı tarzlarına ve dünya görüşlerine saygı gösterin. Bir eserin "iyi" olduğuna tek bir tanım yoktur.

Atölyedeki her yorumunuz bir yazarın bir sonraki cümlesini etkiler. Bu sorumluluğu hafiften almayın.`,
    },
    {
      icon: "🛡️",
      id: "moderasyon",
      title: "Moderasyon ve Bildirim",
      color: "var(--legal-accent-cool)",
      content: `Etik dışı gördüğünüz bir içeriği bildirmek için yorum veya içerik yanındaki "Bildir" seçeneğini kullanın. Tüm bildirimler gizlilik içinde değerlendirilir.

Moderasyon kararları şu adımları izler:
1. Bildirimin incelenmesi
2. Gerekirse taraflara ulaşılması
3. İçerik kaldırma / uyarı / geçici askıya alma / hesap kapatma

İyi niyetli bildirimler her zaman değerlendirmeye alınır. Kötü niyetli veya asılsız toplu şikâyet kampanyaları da yaptırım kapsamındadır.`,
    },
    {
      icon: "💬",
      id: "kör-atölye",
      title: "Kör Atölye Özel Kuralları",
      color: "var(--legal-accent-warm)",
      content: `Kör Atölye modunda bir eserin yazarı gizlidir. Bu özellik, önyargısız yorum kültürünü desteklemek için tasarlanmıştır.

Kör Atölye'de ek kurallar geçerlidir:

• Yazarın kim olduğunu tahmin etmeye veya açıklamaya çalışmayın
• Yazar kimliği ifşa edildiğinde önceki yorumlarınızı çelişkili biçimde revize etmeyiniz
• "Bu kimin eseri?" sorusunu açık bir şekilde sormayın

Kör Atölye, samimiyet güvenliğine dayalıdır. Bu güveni koruyun.`,
    },
  ];

  return (
    <div className="legal-page ethics-page">
      <header className="legal-header ethics-header">
        <div className="legal-header-ornament">⚖</div>
        <p className="legal-label">ACB Atölyesi</p>
        <h1 className="legal-title">Etik Kurallar</h1>
        <p className="legal-subtitle">
          Atölyemizin ruhu kurallarda değil, birbirimize karşı taşıdığımız özen ve saygıda yaşar.
        </p>

        {/* Yapıcı Yorum Manifestosu */}
        <div className="ethics-manifesto">
          <div className="manifesto-quote-mark">"</div>
          <blockquote>
            Eleştiri bir silahtır, kullandığınız elden daha fazlasını yıkmaz.
            <br />
            Onu bir alet olarak kullanın; yapın, yıkmayın.
          </blockquote>
          <div className="manifesto-quote-mark closing">"</div>
        </div>
      </header>

      {/* Yapıcı vs Yıkıcı Karşılaştırma */}
      <div className="ethics-compare-wrapper">
        <div className="ethics-compare">
          <div className="compare-col destructive">
            <div className="compare-header">
              <span className="compare-icon">✗</span>
              <span>Yıkıcı Yorum</span>
            </div>
            <ul>
              <li>"Bu hiç olmamış."</li>
              <li>"Yazmayı bırak."</li>
              <li>"Karakterler tamamen aptal."</li>
              <li>"Sıkıcı, okuyamadım."</li>
              <li>"Zaman kaybı."</li>
            </ul>
          </div>
          <div className="compare-divider">
            <div className="compare-arrow">→</div>
          </div>
          <div className="compare-col constructive">
            <div className="compare-header">
              <span className="compare-icon">✓</span>
              <span>Yapıcı Yorum</span>
            </div>
            <ul>
              <li>"3. bölümde tempo düşüyor; sahneyi kısaltmayı deneyebilirsiniz."</li>
              <li>"Yazarın potansiyelini 2. bölümde görebildim, öne çekilebilir."</li>
              <li>"Kararların motivasyonu daha güçlü kurulabilir."</li>
              <li>"Açılış kancası gücünü orta bölümde yitiriyor."</li>
              <li>"Diyalog sesi tutarsız; 4. sahneyle karşılaştırın."</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="legal-container">
        <aside className="legal-toc">
          <p className="toc-label">İlkeler</p>
          <nav>
            {principles.map((p) => (
              <a key={p.id} href={`#${p.id}`} className="toc-item">
                <span className="toc-emoji">{p.icon}</span>
                <span>{p.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <main className="legal-content">
          {principles.map((p, i) => (
            <section key={p.id} id={p.id} className="legal-section ethics-section">
              <div className="section-header ethics-section-header">
                <span className="ethics-icon-large">{p.icon}</span>
                <h2 className="section-title">{p.title}</h2>
              </div>
              <div className="section-body">
                {p.content.split("\n\n").map((para, j) => (
                  <p
                    key={j}
                    className={
                      para.startsWith("•") || para.startsWith("→") || para.startsWith("1.")
                        ? "bullet-block"
                        : ""
                    }
                  >
                    {para}
                  </p>
                ))}
              </div>
              {i < principles.length - 1 && <div className="section-divider" />}
            </section>
          ))}

          {/* Yemin / Taahhüt Bölümü */}
          <div className="ethics-pledge">
            {pledged ? (
              <div className="pledge-confirmed">
                <div className="pledge-checkmark">✦</div>
                <h3>Taahhüdünüz alındı.</h3>
                <p>
                  Atölye topluluğuna katıldığınız için teşekkürler. Yazmaya ve birbirini büyütmeye
                  devam edelim.
                </p>
              </div>
            ) : (
              <>
                <h3 className="pledge-title">Atölye Taahhüdü</h3>
                <p className="pledge-subtitle">
                  Bu atölyenin bir parçası olarak aşağıdaki ilkeleri benimsiyorum:
                </p>
                <div className="pledge-items">
                  {PLEDGES.map((text, i) => (
                    <label key={i} className={`pledge-item ${checks[i] ? "checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checks[i]}
                        onChange={() => toggleCheck(i)}
                      />
                      <span className="pledge-checkbox">{checks[i] ? "✓" : ""}</span>
                      <span>{text}</span>
                    </label>
                  ))}
                </div>
                <button
                  className={`pledge-button ${checkedAll ? "ready" : "disabled"}`}
                  onClick={handlePledge}
                  disabled={!checkedAll}
                >
                  {checkedAll ? "Taahhüdümü Onaylıyorum" : "Tüm Maddeleri İşaretleyin"}
                </button>
              </>
            )}
          </div>

          <div className="legal-footer-note">
            <span className="footer-ornament">❧</span>
            <p>
              Etik ihlal bildirimleri için{" "}
              <a href="mailto:etik@acbatolyesi.com">etik@acbatolyesi.com</a>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}