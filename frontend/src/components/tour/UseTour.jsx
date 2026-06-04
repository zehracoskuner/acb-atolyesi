import { useState, useEffect, useCallback } from "react";

const TOUR_KEY = "acb_tour_done";

export const useTour = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentPage, setCurrentPage] = useState("atolyem");

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      setTimeout(() => setIsActive(true), 800);
    }
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((s) => s + 1);
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(TOUR_KEY, "true");
  }, []);

  const restartTour = useCallback(() => {
    localStorage.removeItem(TOUR_KEY);
    setCurrentStep(0);
    setCurrentPage("atolyem");
    setIsActive(true);
  }, []);

  return {
    isActive,
    currentStep,
    currentPage,
    setCurrentPage,
    nextStep,
    prevStep,
    endTour,
    restartTour,
  };
};