import { useState, useEffect } from "react";
import "../styles/LegalPages.css";

export default function GizlilikPolitikasi() {
  const [activeSection, setActiveSection] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sections = [
    {
      id: "toplanan-veriler",
      number: "I",
      title: "Toplanan Veriler",
      content: `ACB Atölyesi, hizmetlerimizi sunabilmek için yalnızca gerekli minimum veriyi toplar.

Hesap verileri: Kayıt sırasında sağladığınız ad, kullanıcı adı ve e-posta adresi.

İçerik verileri: Platform üzerinde oluşturduğunuz eserler, bölümler, günlük kayıtları ve paylaşımlar.

Teknik veriler: IP adresi, tarayıcı türü, cihaz bilgisi, oturum süreleri ve sayfa gezinme verileri. Bu veriler yalnızca güvenlik ve performans iyileştirme amacıyla işlenir.

Google ile giriş yapmanız halinde Google hesabınızdan yalnızca ad ve e-posta adresi alınır; parola veya ödeme bilgilerine erişilmez.`,
    },
    {
      id: "kullanim-amaci",
      number: "II",
      title: "Verilerin Kullanım Amacı",
      content: `Topladığımız veriler yalnızca şu amaçlarla kullanılır:

• Hesabınızı oluşturmak ve kimliğinizi doğrulamak
• Platform hizmetlerini size sunmak ve kişiselleştirmek
• Güvenlik ihlallerini tespit etmek ve önlemek
• Hizmet kalitesini artırmak için anonim kullanım istatistikleri üretmek
• Yasal yükümlülükleri yerine getirmek

Verileriniz hiçbir koşulda üçüncü taraflara satılmaz, kiralanmaz veya reklam amaçlı kullanılmaz.`,
    },
    {
      id: "paylasim",
      number: "III",
      title: "Veri Paylaşımı",
      content: `Verilerinizi yalnızca aşağıdaki sınırlı durumlarda üçüncü taraflarla paylaşabiliriz:

Altyapı sağlayıcıları: Sunucu barındırma (hosting), dosya depolama (Cloudinary) ve e-posta iletimi (Nodemailer/Gmail SMTP) gibi teknik hizmetler için çalıştığımız güvenilir sağlayıcılar. Bu sağlayıcılar verilerinizi yalnızca bizim adımıza işler.

Yasal zorunluluk: Mahkeme kararı veya yetkili makam talebi gibi yasal yükümlülüklerin gerektirdiği durumlarda.

Bunların dışında hiçbir kişi veya kuruluşla veri paylaşımı yapılmaz.`,
    },
    {
      id: "cerezler",
      number: "IV",
      title: "Çerezler ve Yerel Depolama",
      content: `Platform, oturum yönetimi ve tercihlerinizi hatırlamak amacıyla çerez ve localStorage kullanır. Bunlar arasında:

• JWT kimlik doğrulama token'ı (oturum süresince)
• Okuma tercihleri (tema, yazı boyutu)
• Sayfa ilerleme kayıtları

Reklam veya izleme amaçlı üçüncü taraf çerez kullanılmaz. Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz; ancak bu durumda bazı özellikler çalışmayabilir.`,
    },
    {
      id: "saklama",
      number: "V",
      title: "Veri Saklama Süresi",
      content: `Hesabınız aktif olduğu sürece verileriniz saklanır. Hesabınızı kapattığınızda kişisel verileriniz 30 gün içinde silinir.

Kamuya açık eserleriniz için önceden içeriği gizli veya taslak konumuna almanızı öneririz. Silinmiş hesaplara ait veriler teknik yedeklerden 90 gün içinde tamamen temizlenir.

Yasal bir yükümlülük bulunması halinde ilgili veriler mevzuatın öngördüğü süre boyunca saklanabilir.`,
    },
    {
      id: "haklariniz",
      number: "VI",
      title: "Haklarınız",
      content: `Türkiye Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında aşağıdaki haklara sahipsiniz:

• Kişisel verilerinizin işlenip işlenmediğini öğrenme
• İşlenme amacını ve bu amaca uygun kullanılıp kullanılmadığını öğrenme
• Yurt içinde veya yurt dışında verilerin aktarıldığı üçüncü kişileri öğrenme
• Eksik veya yanlış işlenmiş verilerin düzeltilmesini talep etme
• Kişisel verilerinizin silinmesini veya yok edilmesini talep etme
• İşlemenin otomatik sistemler aracılığıyla yapılması nedeniyle aleyhinize sonuç doğurmasına itiraz etme

Bu haklarınızı kullanmak için destek@acbatolyesi.com adresine yazabilirsiniz.`,
    },
    {
      id: "guvenlik",
      number: "VII",
      title: "Güvenlik",
      content: `Verilerinizi korumak için endüstri standardı güvenlik önlemleri uygulanmaktadır:

• Parolalar bcrypt ile şifrelenerek saklanır
• API iletişimi JWT kimlik doğrulama ile güvence altına alınır
• HTTPS üzerinden şifreli bağlantı zorunludur
• Hassas işlemler için e-posta doğrulaması uygulanır

Hiçbir sistem %100 güvenli değildir. Bir güvenlik açığı fark ederseniz lütfen güvenlik@acbatolyesi.com adresinden bize bildirin.`,
    },
  ];

  return (
    <div className="legal-page">
      <div className={`legal-nav-indicator ${scrolled ? "visible" : ""}`}>
        Gizlilik Politikası
      </div>

      <header className="legal-header">
        <div className="legal-header-ornament">✦</div>
        <p className="legal-label">ACB Atölyesi</p>
        <h1 className="legal-title">Gizlilik Politikası</h1>
        <p className="legal-subtitle">
          Verilerinize saygı duyuyoruz. Neyi topladığımızı ve nasıl kullandığımızı şeffaf biçimde açıklıyoruz.
        </p>
        <p className="legal-date">Son güncelleme: Mayıs 2026</p>
      </header>

      <div className="legal-container">
        <aside className="legal-toc">
          <p className="toc-label">İçindekiler</p>
          <nav>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`toc-item ${activeSection === s.id ? "active" : ""}`}
                onClick={() => setActiveSection(s.id)}
              >
                <span className="toc-number">{s.number}</span>
                <span>{s.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <main className="legal-content">
          {sections.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              className="legal-section"
              onMouseEnter={() => setActiveSection(s.id)}
            >
              <div className="section-header">
                <span className="section-roman">{s.number}</span>
                <h2 className="section-title">{s.title}</h2>
              </div>
              <div className="section-body">
                {s.content.split("\n\n").map((para, j) => (
                  <p key={j} className={para.startsWith("•") ? "bullet-block" : ""}>
                    {para}
                  </p>
                ))}
              </div>
              {i < sections.length - 1 && <div className="section-divider" />}
            </section>
          ))}

          <div className="legal-footer-note">
            <span className="footer-ornament">❧</span>
            <p>
              KVKK başvuruları için{" "}
              <a href="mailto:kvkk@acbatolyesi.com">kvkk@acbatolyesi.com</a>{" "}
              adresini kullanabilirsiniz.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}