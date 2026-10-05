import { describe, it, expect } from "vitest";
import { buildRound, durationFor, exposureBetween, HALF_HOUR, DAY, minuteOfDay } from "../services/spotlightSchedule.js";

const origin = new Date("2026-10-01T00:00:00+03:00");
const fixtures = count => Array.from({ length: count }, (_, index) => ({ _id: String(index).padStart(3, "0"), firstPublishedAt: new Date(1700000000000 + index * 1000), lastPublishedChapterAt: new Date(1700000000000 + index * 1000) }));

function completeRound(order, history, start, duration) {
  order.forEach((id, index) => {
    const begin = +start + index * duration;
    const item = history.get(id) || { completedShows: 0, anchorMinute: minuteOfDay(begin), exposureMs: Array(48).fill(0) };
    const extra = exposureBetween(begin, begin + duration);
    item.completedShows++;
    item.exposureMs = item.exposureMs.map((value, bin) => value + extra[bin]);
    history.set(id, item);
  });
}

describe("Spotlight fairness", () => {
  it.each([[12, 120], [24, 60], [36, 40], [48, 30], [60, 30], [96, 30]])("allocates %i works at %i minutes without a daily cutoff", (count, minutes) => {
    expect(durationFor(count, false)).toBe(minutes * 60000);
    expect(durationFor(count, true)).toBe(HALF_HOUR);
  });
  it("keeps the 30-minute lock even with only one eligible work", () => {
    expect(durationFor(1, true)).toBe(HALF_HOUR);
  });
  it.each([24, 48])("rotates every one of %i works across opposite and advancing clock slots", count => {
    const works = fixtures(count), history = new Map();
    const duration = durationFor(count, false);
    const starts = new Map(works.map(work => [work._id, []]));
    for (let round = 0; round < 5; round++) {
      const start = +origin + round * DAY;
      const order = buildRound(works, history, start, duration, round === 0);
      expect(new Set(order).size).toBe(count);
      order.forEach((id, index) => starts.get(id).push(minuteOfDay(start + index * duration)));
      completeRound(order, history, start, duration);
    }
    for (const times of starts.values()) {
      const first = times[0], step = duration / 60000;
      expect(times).toEqual([first, (first + 720) % 1440, (first + step) % 1440, (first + 720 + step) % 1440, (first + 2 * step) % 1440]);
    }
  });
  it("counts exposure across midnight and partial bins accurately", () => {
    const bins = exposureBetween(new Date("2026-10-01T23:50:00+03:00"), new Date("2026-10-02T00:30:00+03:00"));
    expect(bins[47]).toBe(10 * 60000);
    expect(bins[0]).toBe(HALF_HOUR);
    expect(bins.reduce((sum, value) => sum + value, 0)).toBe(40 * 60000);
  });
  it("new chapter activity breaks ties but never creates a second turn", () => {
    const works = fixtures(8);
    const order = buildRound(works, new Map(), origin, HALF_HOUR);
    expect(order[0]).toBe("007");
    expect(new Set(order).size).toBe(8);
    expect(buildRound([...works].reverse(), new Map(), origin, HALF_HOUR, true)).toEqual(works.map(work => work._id));
  });
  it("a newcomer cannot take extra turns to catch up with older works", () => {
    const works = fixtures(60);
    const history = new Map(works.slice(0, 59).map(work => [work._id, { completedShows: 20, exposureMs: Array(48).fill(1000) }]));
    const order = buildRound(works, history, origin, HALF_HOUR);
    expect(order[0]).toBe("059");
    expect(order).toHaveLength(60);
    expect(new Set(order).size).toBe(60);
  });
});
