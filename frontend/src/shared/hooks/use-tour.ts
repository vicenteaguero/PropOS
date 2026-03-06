import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "propos-tour-completed";

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function useTour() {
  const hasCompletedTour = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const markCompleted = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    // Force re-render by dispatching a storage event
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return { hasCompletedTour, markCompleted, resetTour };
}
