import { useEffect, useState } from "react";
let focused = false;
const listeners = new Set();
export function setWritingFocus(value) {
  focused = value;
  listeners.forEach(listener => listener(value));
}
export function useWritingFocus() {
  const [value, setValue] = useState(() => focused);
  useEffect(() => {
    listeners.add(setValue);
    setValue(focused);
    return () => listeners.delete(setValue);
  }, []);
  return value;
}
