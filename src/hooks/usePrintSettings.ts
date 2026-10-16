import { useSyncExternalStore } from 'react';

import { readPrintSettings, type PrintSettings } from '@/domain/floorList/printSettings';

/**
 * The List Maker print setup, on this device (2026-10-16). One store, so a
 * change in the setup reaches every export button on the page at once.
 */
const KEY = 'plano.floorPrint';

let current: PrintSettings = (() => {
  try {
    return readPrintSettings(localStorage.getItem(KEY));
  } catch {
    return readPrintSettings(null);
  }
})();
const listeners = new Set<() => void>();

export function setPrintSettings(next: PrintSettings): void {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept (private window): it still applies until the page closes.
  }
  listeners.forEach((listener) => listener());
}

export function usePrintSettings(): PrintSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
