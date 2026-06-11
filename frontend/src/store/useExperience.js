import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function useExperience() {
  const [level, setLevel] = useState("no-experience"); // varsayılan
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { setLoading(false); return; }
    const u = JSON.parse(raw);
    if (!u?._id) { setLoading(false); return; }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/experience/${u._id}`);
        if (!res.ok) throw new Error("not ok");
        const data = await res.json(); // { level: 'no-experience' | ... }
        setLevel(data?.level || "no-experience");
      } catch {
        setLevel("no-experience");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { level, loading };
}
