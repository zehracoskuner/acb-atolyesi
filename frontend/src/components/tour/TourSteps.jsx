// ─── Tur Sayfa Sıraları ───────────────────────────────────────────────────────
export const WORK_TOUR_PAGES    = ["atolyem", "karakter", "plotworld", "write"];
export const EXPLORE_TOUR_PAGES = ["kesfet", "profil"];
export const TOUR_PAGES         = WORK_TOUR_PAGES; // geriye dönük uyumluluk

// ─── Adımlar ─────────────────────────────────────────────────────────────────
// "conditional: true" → element DOM'da olmayabilir, waitForElement timeout'a düşmesin,
//   bunun yerine TourManager önce triggerFn'i çağırır (varsa), sonra element bekler.
// "alwaysVisible: true" → element her zaman DOM'da, normal akış.
// "skipIfMissing: true" → element yoksa bu adımı atla, bir sonrakine geç.

export const TOUR_STEPS = {

  /* ── ATÖLYE ─────────────────────────────────────────────────────────── */
  atolyem: [
    {
      id: "atolyem-giris",
      target: "atolyem-baslik",
      title: "Eserinin Merkezi ✦",
      text: "Bu senin eser sayfan. Buradan bölümlerine, karakterlerine ve olay örgüsüne ulaşabilirsin.",
      position: "bottom",
      alwaysVisible: true,
    },
    {
      id: "atolyem-kapak",
      target: "atolyem-kapak",
      title: "Kapağını Değiştir",
      text: "Kapak görseline tıklayarak kendi kapak fotoğrafını yükleyebilirsin.",
      position: "right",
      alwaysVisible: true,
    },
    {
      id: "atolyem-yaz",
      target: "atolyem-yaz-btn",
      title: "Yaz",
      text: "Bölümlerine buradan ulaşır, kaldığın yerden devam edersin.",
      position: "top",
      alwaysVisible: true,
    },
    {
      id: "atolyem-duzenle",
      target: "atolyem-duzenle-btn",
      title: " Hikayeni düzenle & Yayın ayarları",
      text: "Eserinin bilgilerini, önsözünü ve ayarlarını buradan güncelleyebilirsin. Bölümleri yayınlamayı ise Bölümler ekranından yapıyorsun.",
      position: "top",
      alwaysVisible: true,
    },
    {
      id: "atolyem-araclar",
      target: "atolyem-araclar",
      title: "Proje Araçların",
      text: "Bölümler, karakterler, olay örgüsü ve notlar — hikayen için ihtiyacın olan her şey burada.",
      position: "top",
      alwaysVisible: true,
    },
  ],

  /* ── KARAKTER ───────────────────────────────────────────────────────── */
  karakter: [
    {
      id: "karakter-giris",
      target: "karakter-baslik",
      title: "Karakterler Evreni",
      text: "Her büyük hikaye unutulmaz karakterlerle başlar. Burası senin karakterlerini hayata geçireceğin yer.",
      position: "bottom",
      alwaysVisible: true,
    },
    {
      id: "karakter-ekle",
      target: "karakter-ekle-btn",
      title: "Yeni Karakter Oluştur",
      text: "➕ butonuna basarak yeni karakter ekle. İsim, rol, motivasyon — ne kadar doluysa AI o kadar derinleştirebilir. Hemen bir karakter oluştur ve çift tıklayarak karakteri hayata geçir.",
      position: "bottom",
      alwaysVisible: true,
    },
    {
      // Bu adım karakter editörü açıkken görünür.
      // triggerFn: TourManager bu adıma gelince window.__acbOpenCharEditor?() çağırır.
      // CharactersUniversePage içinde ilk karakter varsa editörü açar.
      id: "karakter-detay",
      target: "karakter-detay-btn",
      title: "AI ile Derinleştir ✦",
      text: "Karakterini çift tıklayarak aç, ardından ✨ Derinleştir butonuyla AI karakterinin iç dünyasını analiz edebilir.",
      position: "left",
      conditional: true,          // element koşullu — editör açık olmadan görünmez
      triggerKey: "openCharEditor", // window.__acbTourTrigger["openCharEditor"]?.() çağrılır
      skipIfMissing: true,         // 3 saniye bekle, yoksa atla
    },
    {
      id: "karakter-sahne-kivilcimi",
      target: "karakter-sahne-modu",
      title: "Sahne Kıvılcımı ✦",
      text: "Sahne Modu'nu aç, iki karaktere tıkla — AI o iki karakter arasında dramatik bir sahne taslağı üretir. Sadece bir kıvılcım, gerisini sen yazarsın.",
      position: "bottom",
      skipIfMissing: true,
    },
  ],

  /* ── PLOTWORLD ──────────────────────────────────────────────────────── */
  plotworld: [
    {
      id: "plotworld-giris",
      target: "plotworld-baslik",
      title: "PlotWorld — Hikayenin Haritası",
      text: "Sahnelerini, olayları ve karakterlerin yollarını görsel olarak burada bağlayabilirsin.",
      position: "bottom",
      alwaysVisible: true,
    },
    {
      id: "plotworld-perde",
      target: "plotworld-perde-yapi",
      title: "Perde Yapısı",
      text: "Hikayeni Giriş, Gelişme, Sonuç perdelerine — ya da daha karmaşık yapılara — bölerek olay örgünü buradan kurgulamaya başla. Her sahneyi sürükle, doğru perdeye bırak.",
      position: "right",
      alwaysVisible: true,
    },
    {
      id: "plotworld-sahne",
      target: "plotworld-sahne-ekle",
      title: "Sahne Ekle",
      text: "+ Sahne butonuyla yeni bir sahne ekle. Her sahneyi bir düğüm olarak düşün — sürükle, bağla, yeniden düzenle.",
      position: "left",
      alwaysVisible: true,
    },
    {
      // Çizim Alanı sekmesine geçilince görünür
      id: "plotworld-cizim",
      target: "plotworld-cizim-alani",
      title: "Serbest Çizim Alanı",
      text: "Hikayeni önce kafanda çiz. Sahneler, bağlantılar, karakterler — kurallara bağlı kalmadan özgürce taslak at.",
      position: "top",
      triggerKey: "openDrawTab",   // TourManager bu adıma gelince Çizim sekmesini açar
      conditional: true,
      skipIfMissing: true,
    },
    {
      // Karakter Arkı sekmesine geçilince görünür
      id: "plotworld-ark",
      target: "plotworld-ark-panel",
      title: "Karakter Arkı",
      text: "Karakterinin yolculuğunu çiz — başlangıçtan dönüşüm anına, kırılma noktasından çözüme.",
      position: "top",
      triggerKey: "openArcTab",    // TourManager bu adıma gelince Karakter Arkı sekmesini açar
      conditional: true,
      skipIfMissing: true,
    },
    {
      id: "plotworld-ai",
      target: "plotworld-ai-btn",
      title: "AI Olay Örgüsü Analizi ✦",
      text: "Sahnelerini ekledikten sonra AI hikayenin ritmine, boşluklarına ve dramatik potansiyeline dair analiz sunabilir.",
      position: "bottom",
      alwaysVisible: true,
    },
  ],

  /* ── WRITE ──────────────────────────────────────────────────────────── */
  write: [
    {
      id: "write-yeni-bolum",
      target: "write-yeni-bolum",
      title: "Yeni Bölüm Oluştur",
      text: "Her büyük hikaye küçük bir bölümle başlar. + butonuna basarak ilk bölümünü oluştur.",
      position: "right",
      alwaysVisible: true,
    },
    {
      id: "write-yayinla",
      target: "write-yayinla-btn",
      title: "Yayınla",
      text: "Bölümünü bitirince buradan yayınlayabilirsin. Önce içerik incelemesinden geçer, sonra okurlar görebilir.",
      position: "bottom",
      skipIfMissing: true,
    },
    {
      id: "write-odak",
      target: "write-odak-btn",
      title: "Odak Modu",
      text: "Tüm dağıtıcıları kapat, sadece yaz. F11 ile de açılır. En verimli yazma modun.",
      position: "bottom",
      skipIfMissing: true,
    },
    {
      id: "write-atolye",
      target: "write-atolye-tab",
      title: "Atölye ✦",
      text: "Sprint modları, AI koç, kısıtlama egzersizleri — yazma rutinini buradan kur.",
      position: "right",
      triggerKey: "openAtelierTab",  // Atölye sekmesini otomatik aç
      conditional: true,
      skipIfMissing: true,
    },
    {
      id: "write-ai",
      target: "write-ai-btn",
      title: "AI ile Yorumla ✦",
      text: "Yazdıktan sonra AI bölümünü analiz edebilir — ritim, karakterizasyon, boşluklar.",
      position: "bottom",
       triggerKey: "openBolumlerTab",
      alwaysVisible: true,
    },
    {
      id: "write-son",
      target: "write-editor",
      title: "Hadi Başlayalım ✦",
      text: "Beyaz sayfa seni bekliyor. Mükemmel cümleyi bekleme — sadece yaz. İlk kelime her zaman en zor olanıdır.",
      position: "top",
      alwaysVisible: true,
    },
  ],

  /* ── KEŞFET ─────────────────────────────────────────────────────────── */
  kesfet: [
    {
      id: "kesfet-giris",
      target: "kesfet-baslik",
      title: "Topluluğu Keşfet",
      text: "Diğer yazarların paylaştığı eserleri burada okuyabilirsin. Belki bir hikaye sena ilham verir.",
      position: "bottom",
      alwaysVisible: true,
    },
    {
      id: "kesfet-filtre",
      target: "kesfet-filtre",
      title: "Filtrele ve Bul",
      text: "Türe, yazara veya esere göre arama yapabilirsin. Beğendiğin esere tıkla, okuma listene ekle, kaldığın yerden devam et.",
      position: "bottom",
      alwaysVisible: true,
    },
  ],

  /* ── PROFİL ─────────────────────────────────────────────────────────── */
  profil: [
    {
      id: "profil-giris",
      target: "profil-baslik",
      title: "Senin Alanın",
      text: "Profilin sadece bir sayfa değil — yazı yolculuğunun günlüğü.",
      position: "bottom",
      alwaysVisible: true,
    },
    {
      id: "profil-log",
      target: "profil-log-tab",
      title: "Günlük Yazı Logları",
      text: "Her gün ne kadar yazdığını buradan takip edebilirsin. Küçük adımlar büyük hikayeleri inşa eder.",
      position: "right",
      alwaysVisible: true,
    },
    {
      id: "profil-okuma",
      target: "profil-okuma-tab",
      title: "Okuma Listesi",
      text: "Keşfet'te beğendiğin eserleri buradan bulabilirsin. Okumak da yazmak kadar öğreticidir.",
      position: "right",
      alwaysVisible: true,
    },
    {
      id: "profil-alinti",
      target: "profil-alinti-tab",
      title: "Alıntılarım ✦",
      text: "Okurken seni etkileyen satırları buraya kaydet. Bir eserde 'Alıntıla' butonuna bastığında o söz burada seni bekler.",
      position: "right",
      skipIfMissing: true,
    },
  ],
};

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
export const getNextPage = (currentPage, tourType = "work") => {
  const pages = tourType === "explore" ? EXPLORE_TOUR_PAGES : WORK_TOUR_PAGES;
  return pages[pages.indexOf(currentPage) + 1] || null;
};

export const getTotalSteps = (tourType = "work") => {
  const pages = tourType === "explore" ? EXPLORE_TOUR_PAGES : WORK_TOUR_PAGES;
  // Tüm adımları say (skipIfMissing olanlar çalışma zamanında atlanabilir ama
  // sayaç tutarlı görünsün diye toplam sayıya dahil ediyoruz)
  return pages.reduce((acc, p) => acc + (TOUR_STEPS[p]?.length || 0), 0);
};