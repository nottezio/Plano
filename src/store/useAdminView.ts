import { create } from 'zustand';

/**
 * When the admin last opened this account's patients, read from the account's
 * own access record (already listened to by `AccessGate`). Shown in Akun so
 * the account can see that, and when, the admin looked. `null` = never.
 */
export const useAdminView = create<{ lastAdminViewAt: Date | null }>(() => ({ lastAdminViewAt: null }));
