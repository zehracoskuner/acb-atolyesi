import { useState, useEffect } from "react";
import "../styles/LegalPages.css";

export default function KullaniciSozlesmesi() {
  const [activeSection, setActiveSection] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sections = [
    {
      id: "taraflar",
      number: "I",
      title: "Taraflar ve Kapsam",
      content: `Bu Kullanıcı Sözleşmesi ("Sözleşme"), ACB Atölyesi platformunu ("Platform") işleten ACB Atölyesi ("Biz", "Atölye") ile platforma kayıt olan veya platformu kullanan gerçek kişi ("Kullanıcı", "Yazar") arasında akdedilmektedir.

Platforma kayıt olarak veya hizmetlerimizi kullanarak bu Sözleşme'nin tüm koşullarını okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmiş olursunuz. Bu koşulları kabul etmiyorsanız lütfen platformu kullanmayınız.`,
    },
    {
      id: "hizmet",
      number: "II",
      title: "Hizmetin Tanımı",
      content: `ACB Atölyesi; yazarlara yaratıcı yazarlık süreçlerini desteklemek amacıyla dijital bir çalışma ortamı sunar. Platform kapsamında şu hizmetler sağlanmaktadır:

• Çevrimiçi eser yazma ve düzenleme araçları
• Bölüm ve proje yönetimi
• Yazarlık günlüğü ve ilerleme takibi
• Atölye topluluğunda eser paylaşımı ve okuyucu geri bildirimi
• Yapay zeka destekli yazarlık koçu

Platform, zaman zaman önceden bildirim yapmaksızın güncelleme ve değişiklik hakkını saklı tutar.`,
    },
    {
      id: "hesap",
      number: "III",
      title: "Hesap Oluşturma ve Güvenlik",
      content: `Platforma üye olmak için 13 yaşını doldurmuş olmanız gerekmektedir. 18 yaş altı kullanıcıların ebeveyn veya vasi onayı alması önerilir.

Hesabınızın güvenliğinden tamamen siz sorumlusunuz. Şifrenizi kimseyle paylaşmamalı, hesabınıza yetkisiz erişim fark ettiğinizde derhal bizimle iletişime geçmelisiniz.

Tek bir gerçek kişi adına yalnızca bir hesap açılabilir. Toplu kayıt, bot kayıt veya başka kişiler adına hesap oluşturulması yasaktır.`,
    },
    {
      id: "fikri-mulkiyet",
      number: "IV",
      title: "Fikri Mülkiyet Hakları",
      content: `Platform aracılığıyla oluşturduğunuz tüm özgün eserler üzerindeki telif hakkı size aittir. ACB Atölyesi, eserleriniz üzerinde herhangi bir mülkiyet hakkı talep etmez.

Eserlerinizi Platform üzerinde paylaştığınızda; Atölye'ye, söz konusu eserleri yalnızca hizmet amacıyla (teknik depolama, önbellek, düzeltme, Platform içi görüntüleme) kullanmak üzere sınırlı, münhasır olmayan, devredilemez bir lisans tanımış olursunuz.

Platform'un kendisi (kod tabanı, tasarım, marka unsurları, özgün içerik) ACB Atölyesi'ne aittir ve izinsiz kopyalanamaz, dağıtılamaz.`,
    },
    {
      id: "yasaklar",
      number: "V",
      title: "Yasaklanan İçerik ve Davranışlar",
      content: `Aşağıdaki içerikleri oluşturmak, paylaşmak veya teşvik etmek kesinlikle yasaktır:

• Nefret söylemi, ayrımcılık veya şiddeti körükleyen içerikler
• Gerçek kişileri karalayan veya onların rızası olmaksızın kişisel bilgilerini ifşa eden içerikler
• Başkasına ait telif hakkı korumalı eserlerin izinsiz kopyalanması
• Kullanıcıları aldatmaya yönelik yanıltıcı bilgiler
• Zararlı yazılım yaymaya veya sisteme zarar vermeye yönelik her türlü girişim

Etik Atölye Kuralları kapsamındaki yükümlülükler de bu maddenin ayrılmaz bir parçasıdır.`,
    },
    {
      id: "sonlandirma",
      number: "VI",
      title: "Hesap Askıya Alma ve Sonlandırma",
      content: `Bu Sözleşme'yi ihlal etmeniz halinde hesabınız önceden uyarı yapılmaksızın askıya alınabilir veya kalıcı olarak kapatılabilir.

Hesabınızı kendiniz kapatmak isterseniz Ayarlar bölümünden işlemi gerçekleştirebilirsiniz. Hesap kapatma işlemi geri alınamaz; kamuya açık eserleriniz Platform'dan kaldırılır, ancak teknik yedekler yasal saklama süreleri boyunca tutulabilir.

ACB Atölyesi, hizmetin bütünlüğünü korumak amacıyla gerekli gördüğü durumlarda içerik kaldırma ve hesap askıya alma kararı verme hakkını saklı tutar.`,
    },
    {
      id: "sorumluluk",
      number: "VII",
      title: "Sorumluluk Sınırlaması",
      content: `Platform "olduğu gibi" sunulmaktadır. Hizmet kesintileri, veri kayıpları veya üçüncü taraf içeriklerinden kaynaklanabilecek zararlar için ACB Atölyesi'nin sorumluluğu, yasaların izin verdiği azami ölçüde sınırlandırılmıştır.

Olası kesintilere karşı eserlerinizin yerel yedeklerini düzenli olarak almanızı şiddetle tavsiye ederiz.`,
    },
    {
      id: "degisiklikler",
      number: "VIII",
      title: "Sözleşme Değişiklikleri",
      content: `Bu Sözleşme'yi zaman zaman güncelleyebiliriz. Önemli değişiklikler Platform üzerinden ve kayıtlı e-posta adresinize bildirim yapılarak duyurulacaktır.

Değişiklikten sonra platforma girişiniz, güncellenmiş Sözleşme'yi kabul ettiğiniz anlamına gelir.

Bu Sözleşme Türkiye Cumhuriyeti kanunlarına tabidir.`,
    },
  ];

  return (
    <div className="legal-page">
      <div className={`legal-nav-indicator ${scrolled ? "visible" : ""}`}>
        Kullanıcı Sözleşmesi
      </div>

      <header className="legal-header">
        <div className="legal-header-ornament">✦</div>
        <p className="legal-label">ACB Atölyesi</p>
        <h1 className="legal-title">Kullanıcı Sözleşmesi</h1>
        <p className="legal-subtitle">
          Atölyemize hoş geldiniz. Birlikte üretmede önce lütfen bu koşulları okuyunuz.
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
              Sorularınız için{" "}
              <a href="mailto:destek@acbatolyesi.com">destek@acbatolyesi.com</a>{" "}
              adresine yazabilirsiniz.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}