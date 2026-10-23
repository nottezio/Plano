import {
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { feedbackCol, feedbackDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import {
  type Feedback,
  type FeedbackDevice,
  type FeedbackKind,
  type FeedbackStatus,
} from '@/domain/feedback';
import { readSessionLog, type SessionEvent } from '@/lib/sessionLog';
import { APP_VERSION } from '@/version.js';

/**
 * Firestore access for bug reports and suggestions. Path: `feedback/{id}`.
 * Anyone admitted may create one; only the admin reads or updates them.
 */

function currentDevice(): FeedbackDevice {
  return {
    appVersion: APP_VERSION,
    userAgent: navigator.userAgent,
    viewport: `${String(window.innerWidth)}x${String(window.innerHeight)}`,
    online: navigator.onLine,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
  };
}

/**
 * Sends a report. Like every other write it lands in the offline cache at once
 * and reaches the server when the device is online. Bug reports carry the
 * session log; suggestions do not need it.
 */
export function sendFeedback(
  user: { uid: string; email: string },
  kind: FeedbackKind,
  text: string,
): Promise<unknown> {
  return trackWrite(
    addDoc(feedbackCol(), {
      uid: user.uid,
      email: user.email,
      kind,
      text,
      status: 'baru',
      createdAt: serverTimestamp(),
      device: currentDevice(),
      log: kind === 'bug' ? readSessionLog() : [],
    }),
  );
}

/* Admin only. The rules refuse these for anyone else. */

const toDate = (value: unknown): Date | null =>
  value && typeof (value as Timestamp).toDate === 'function' ? (value as Timestamp).toDate() : null;

function toFeedback(id: string, data: Record<string, unknown>): Feedback {
  const device = (data.device ?? {}) as Partial<FeedbackDevice>;
  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : '',
    email: typeof data.email === 'string' ? data.email : '',
    kind: data.kind === 'fitur' ? 'fitur' : 'bug',
    text: typeof data.text === 'string' ? data.text : '',
    status: data.status === 'selesai' ? 'selesai' : 'baru',
    createdAt: toDate(data.createdAt),
    device: {
      appVersion: String(device.appVersion ?? ''),
      userAgent: String(device.userAgent ?? ''),
      viewport: String(device.viewport ?? ''),
      online: device.online !== false,
      standalone: device.standalone === true,
    },
    log: Array.isArray(data.log) ? (data.log as SessionEvent[]) : [],
  };
}

export function subscribeFeedback(
  onChange: (reports: Feedback[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(feedbackCol(), orderBy('createdAt', 'desc')),
    (snapshot) => onChange(snapshot.docs.map((docSnap) => toFeedback(docSnap.id, docSnap.data()))),
    onError,
  );
}

export function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  return trackWrite(updateDoc(feedbackDoc(id), { status }));
}
