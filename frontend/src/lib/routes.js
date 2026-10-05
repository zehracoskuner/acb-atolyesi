export const EXPLORE_PATH = "/keşfet";

// All other application routes are personal; auth/legal routes live outside the gate.
export function isPublicPage(pathname) {
  let path;
  try { path = decodeURI(pathname); } catch { return false; }
  return /^\/(keşfet|kesfet|story\/[^/]+|profile\/(?!me(?:\/|$))[^/]+|landing)\/?$/.test(path);
}
