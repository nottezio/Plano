import { create } from 'zustand';

import { clearPin, hasPin, setPin, verifyPin } from '@/lib/pinCrypto';

interface LockState {
  /** True when the lock screen should cover the app. */
  locked: boolean;
  pinEnabled: boolean;
  /** Consecutive wrong attempts — drives the backoff message. */
  failures: number;
  /** True while the app is backgrounded and content should be blurred. */
  obscured: boolean;

  lock: () => void;
  unlock: (pin: string) => Promise<boolean>;
  setObscured: (obscured: boolean) => void;
  refreshPinState: () => void;
  createPin: (pin: string) => Promise<void>;
  removePin: () => void;
}

export const useLock = create<LockState>((set, get) => ({
  // Locked at boot whenever a PIN exists: an app resumed from a cold start is
  // exactly the case where someone else may be holding the device.
  locked: hasPin(),
  pinEnabled: hasPin(),
  failures: 0,
  obscured: false,

  lock: () => {
    if (get().pinEnabled) set({ locked: true });
  },

  unlock: async (pin) => {
    const ok = await verifyPin(pin);
    set(ok ? { locked: false, failures: 0 } : { failures: get().failures + 1 });
    return ok;
  },

  setObscured: (obscured) => set({ obscured }),

  refreshPinState: () => {
    const enabled = hasPin();
    set({ pinEnabled: enabled, locked: enabled ? get().locked : false });
  },

  createPin: async (pin) => {
    await setPin(pin);
    set({ pinEnabled: true, locked: false, failures: 0 });
  },

  removePin: () => {
    clearPin();
    set({ pinEnabled: false, locked: false, failures: 0 });
  },
}));
