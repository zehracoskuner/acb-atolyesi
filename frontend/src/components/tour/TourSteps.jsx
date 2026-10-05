// Tours describe only the current screen; they never navigate or write.
export const TOUR_VERSION = "2026-09-24";
const step = (target, title, text, optional = false) => ({ target, title, text, optional });
export const TOUR_STEPS = {
  general: [
    step("topbar-kesfet", "Keşfet", "Yeni hikâyeler ve yazarlarla burada tanışabilirsin."),
    step("topbar-library", "Kütüphanem", "Okuma listelerine ve takip ettiğin eserlere buradan ulaşabilirsin."),
    step("topbar-atolyem", "Atölyem", "Eserlerini burada bulabilir, Yeni Eser Oluştur ile ilk hikâyene başlayabilirsin. Eserini açtığında Yardım’dan o ekranın kısa rehberini seçebilirsin."),
    step("tour-help", "Yardım hep burada", "Genel tanıtımı veya bulunduğun ekranın kısa rehberini buradan yeniden açabilirsin."),
  ],
  studio: [step("studio-create", "Yeni eser oluştur", "Hazır olduğunda bu düğmeyle eserine bir ad verebilirsin. Eserini açınca yazma ve planlama araçlarının rehberi Yardım’da seni bekler.")],
  work: [
    step("atolyem-yaz-btn", "Bölümler", "Bölümlerini yazmak için buradan yazı ekranına geçebilirsin. Kayıt durumunu o ekranda takip edebilirsin."),
    step("atolyem-notlar", "Eser notları", "Bu esere ait fikirlerini ve hatırlatmalarını burada tutabilirsin."),
    step("atolyem-karakterler", "Karakterler", "Hikâyendeki kişileri ve aralarındaki bağları burada geliştirebilirsin."),
    step("atolyem-plotworld", "Sahne panosu ve evren", "Sahnelerini, olay örgüsünü ve hikâyenin dünyasını burada planlayabilirsin. Her ekranın rehberi Yardım’da."),
  ],
  chapters: [
    step("write-save-status", "Kayıt durumu", "“Kaydedildi” sunucu kaydını belirtir. Üzerine tıklayarak son kaydı ve bekleyen değişiklikleri görebilirsin. Yerel taslak sunucu kaydı değildir."),
    step("write-chapters", "Bölümlerin", "Bölümler sekmesinden yazılarına ulaşabilir, hazır olduğunda yeni bölüm ekleyebilirsin."),
    step("write-editor", "Yazı alanın", "Metnini burada yazabilirsin. Tur metnini değiştirmez; bitirdiğinde kaldığın yerden devam edebilirsin.", true),
  ],
  atelier: [
    step("atelier-intro", "Atölye", "Burası bölüm metninden ayrı bir egzersiz alanı. Taslağın bu tarayıcıda saklanır; sekme değiştirip geri dönebilir veya sayfayı yenileyebilirsin.", true),
    step("atelier-training", "Antrenman", "Bir beceri seç, kısıtı editöre aktar ve kendi metninle dene.", true),
    step("atelier-routine", "Sprint ve rutin", "Kısa bir yazma sprinti, ısınma veya düzenleme süresi başlatabilirsin.", true),
    step("atelier-bag", "Kelime Çantası", "Tekrarlanan kelimeleri ve ifadeleri gör; sesine ait olanları veya göz ardı etmek istediklerini işaretle.", true),
    step("atelier-save", "Nota Kaydet", "Yerel egzersiz taslağını bu esere bağlı bir sunucu notuna kaydeder. Bölüm kaydıyla ayrıdır.", true),
    step("atelier-compass", "Pusula", "Yerel yazım ipuçlarını bir araya getirir ve çalışabileceğin alanları gösterir. Bir başarı puanı değildir.", true),
  ],
  characters: [step("karakter-baslik", "Karakter evreni", "Karakterlerini ve ilişkilerini burada bir arada görebilirsin."), step("karakter-ekle-btn", "Yeni bir karakter", "Hazır olduğunda kendi karakterini ekleyebilirsin. Yapay zekâ desteği isteğe bağlıdır; son karar sende.")],
  plot: [
    step("plotworld-ark-btn", "Karakter Arkı", "Karakterlerinin sahneler boyunca yolculuğunu izle. AI analizi için Ayarlar’daki iznin açık olmalı."),
    step("plotworld-board-tab", "Sahne panosu", "Sahnelerini ve aralarındaki bağlantıları Sahne Panosu sekmesinde planlayabilirsin."),
    step("plotworld-world-tabs", "Hikâyenin dünyası", "Evrenin ve karakterlerin hakkında notlarını burada tutabilirsin."),
  ],
};
export function contextTour(path) {
  if (path === "/studio") return "studio";
  if (/^\/work\/[^/]+$/.test(path)) return "work";
  if (/^\/work\/[^/]+\/chapters$/.test(path)) return "chapters";
  if (/^\/work\/[^/]+\/characters$/.test(path)) return "characters";
  if (/^\/work\/[^/]+\/plot$/.test(path)) return "plot";
  return null;
}
