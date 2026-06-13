// backend/utils/streak.js
// Yazma serisi (streak) güncelleme mantığı — tek kaynak.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Saat dilimi tutarsızlıklarını önlemek için günün başlangıcına normalize eder.
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Kullanıcı günlük hedefini tutturduğunda çağrılır.
 * - lastWriteDate dün ise currentStreak +1
 * - lastWriteDate bugünse değişiklik yok (gün içinde tekrar çağrılırsa idempotent)
 * - lastWriteDate daha eski veya null ise currentStreak 1'e sıfırlanır
 * - longestStreak, currentStreak'i aşarsa güncellenir
 *
 * User dokümanını mutasyona uğratır ve geri döner; kaydetmek (save) çağıranın sorumluluğudur.
 */
export function updateWritingStreak(user) {
  const today = startOfDay(new Date());
  const last  = user.lastWriteDate ? startOfDay(user.lastWriteDate) : null;

  if (last && last.getTime() === today.getTime()) {
    // Bugün zaten kaydedildi, değişiklik yok.
  } else if (last && today.getTime() - last.getTime() === MS_PER_DAY) {
    user.currentStreak = (user.currentStreak || 0) + 1;
  } else {
    user.currentStreak = 1;
  }

  if (user.currentStreak > (user.longestStreak || 0)) {
    user.longestStreak = user.currentStreak;
  }

  user.lastWriteDate = new Date();

  return user;
}
