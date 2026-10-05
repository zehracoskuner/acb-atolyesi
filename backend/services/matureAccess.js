import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";
export const readerContext = new AsyncLocalStorage();
export const canReadMature = user => Number.isInteger(user?.birthYear) && user.birthYear <= 2007;
export const validBirthYear = year => Number.isInteger(year) && year >= 1900 && year <= new Date().getUTCFullYear();
export function matureFilter() {
  const reader = readerContext.getStore();
  return reader && !canReadMature(reader) ? { contentWarning: { $ne: true } } : {};
}

// Snapshot fields (quote text, saved chapter titles) also need an age filter.
export function protectWorkReferences(schema, field) {
  schema.pre(/^(find|count|distinct)/, async function () {
    if (Object.keys(matureFilter()).length) {
      const ids = await mongoose.model("Work").distinct("_id", matureFilter());
      this.and([{ [field]: { $in: ids } }]);
    }
  });
}
// Request-scoped protection covers populate, counts and future list APIs.
// Background jobs retain their complete dataset outside reader context.
export function protectWorkReads(schema) {
  schema.pre(/^(find|count|distinct)/, function () {
    const filter = matureFilter();
    if (Object.keys(filter).length) this.and([filter]);
  });
  schema.pre("aggregate", function () {
    const filter = matureFilter();
    if (Object.keys(filter).length) this.pipeline().unshift({ $match: filter });
  });
}
