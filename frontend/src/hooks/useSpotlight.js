import { useEffect, useState } from "react";
import { subscribeSpotlight } from "../lib/spotlightSync";

export default function useSpotlight() {
  const [work, setWork] = useState(null);
  useEffect(() => subscribeSpotlight(setWork), []);
  return work;
}
