export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)     return "az önce";
  if (diff < 3600)   return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

const QUESTIONS = [
  "Bu sahnenin sonunda okuyucunun ne hissetmesini istiyorsun?",
  "Karakterinin söylediğiyle gerçekten istediği şey aynı mı?",
  "Bu bölümden tek bir cümleyi silmek zorunda olsan hangisi olurdu?",
  "Bugün karakterinin senden sakladığı şey ne?",
  "Bu sahnede kim susuyor; suskunluğu neyi değiştiriyor?",
  "Mekânın bir ayrıntısı karakterinin yerine konuşabilir mi?",
  "Okuyucunun bildiği ama karakterinin henüz bilmediği şey ne?",
  "Bu karşılaşma hiç yaşanmasaydı hikâyede ne eksik kalırdı?",
  "Karakterin haklı olmakla mutlu olmak arasında hangisini seçer?",
  "Son cümlen bir kapıyı mı kapatıyor, başka birini mi aralıyor?",
  "Anlattığın duyguyu adını söylemeden nasıl gösterebilirsin?",
  "Bu sahneyi başka birinin gözünden yazsan hangi gerçek değişirdi?",
];

export function questionForDate(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return QUESTIONS[((day % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length];
}
