// src/hooks/useReport.js
import { useState, useCallback } from "react";

export function useReport() {
  const [state, setState] = useState(null); // null = kapalı
 
  const openReport = useCallback((targetType, targetId, targetLabel = "") => {
    setState({ targetType, targetId, targetLabel });
  }, []);
 
  const closeReport = useCallback(() => setState(null), []);
 
  const reportProps = {
    isOpen:      !!state,
    targetType:  state?.targetType  ?? "",
    targetId:    state?.targetId    ?? "",
    targetLabel: state?.targetLabel ?? "",
    onClose:     closeReport,
  };
 
  return { reportProps, openReport };
}