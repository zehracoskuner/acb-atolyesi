import mongoose from "mongoose";

// All publication/rotation dates come from MongoDB, never from a browser clock.
export async function databaseNow() {
  const { localTime } = await mongoose.connection.db.command({ hello: 1 });
  if (!(localTime instanceof Date)) throw new Error("MongoDB clock unavailable");
  return localTime;
}
