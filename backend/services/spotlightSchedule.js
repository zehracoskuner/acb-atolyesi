export const HALF_HOUR = 30 * 60 * 1000;
export const DAY = 48 * HALF_HOUR;
export const HEARTBEAT_GRACE = 60 * 1000;

// Istanbul civil time (UTC+03:00); UTC is still used for every persisted instant.
export function minuteOfDay(date) {
  return ((+new Date(date) + 3 * 60 * 60 * 1000) % DAY + DAY) % DAY / 60000;
}

export function durationFor(count, locked) {
  return locked ? HALF_HOUR : Math.max(HALF_HOUR, Math.ceil(DAY / Math.max(1, count)));
}

export function exposureBetween(start, end) {
  const exposure = Array(48).fill(0);
  for (let time = +new Date(start); time < +new Date(end);) {
    const boundary = (Math.floor(time / HALF_HOUR) + 1) * HALF_HOUR;
    const until = Math.min(boundary, +new Date(end));
    exposure[Math.floor(minuteOfDay(time) / 30)] += until - time;
    time = until;
  }
  return exposure;
}

const publicationOrder = (a, b) => +new Date(a.firstPublishedAt) - +new Date(b.firstPublishedAt) || String(a._id).localeCompare(String(b._id));
export { publicationOrder };

function targetMinute(history, duration) {
  const turns = history.completedShows || 0;
  return ((history.anchorMinute ?? 0) + 720 * (turns % 2) + Math.floor(turns / 2) * duration / 60000) % 1440;
}

// The first round follows publication order. Later rounds allocate actual wall-clock
// slots, with publication activity only breaking ties after the fairness criteria.
export function buildRound(works, histories, start, duration, firstRound = false) {
  const pending = [...works].sort(publicationOrder);
  if (firstRound) return pending.map(work => String(work._id));
  const order = [];
  for (let index = 0; pending.length; index++) {
    const slotStart = +new Date(start) + index * duration;
    const bins = exposureBetween(slotStart, slotStart + duration);
    const minute = minuteOfDay(slotStart);
    const score = work => {
      const history = histories.get(String(work._id)) || {};
      const debt = bins.reduce((sum, ms, bin) => sum + ms / duration * (history.exposureMs?.[bin] || 0), 0);
      const distance = Math.abs(minute - targetMinute(history, duration));
      return [history.completedShows || 0, debt, Math.min(distance, 1440 - distance),
        -Number(new Date(work.lastPublishedChapterAt || work.firstPublishedAt)), Number(new Date(work.firstPublishedAt))];
    };
    const scores = new Map(pending.map(work => [String(work._id), score(work)]));
    pending.sort((a, b) => {
      const left = scores.get(String(a._id)), right = scores.get(String(b._id));
      for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] - right[i];
      return String(a._id).localeCompare(String(b._id));
    });
    order.push(String(pending.shift()._id));
  }
  return order;
}
