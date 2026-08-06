import {
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';

import { templateDoc, templatesCol } from '../paths';
import { trackWrite } from '../syncStatus';
import { DEFAULT_TEMPLATE_BODY } from '@/domain/defaults';
import type { SoapTemplate } from '@/domain/types';

const BUILTIN_ID = 'tpl-default';

/**
 * SPEC 13 — seed exactly one built-in template containing only header lines.
 * Inventing clinical content would be a patient-safety problem, not a
 * convenience: a resident could paste a plausible-looking normal exam they
 * never performed.
 */
export function seedDefaultTemplate(uid: string): Promise<void> {
  return trackWrite(
    setDoc(
      templateDoc(uid, BUILTIN_ID),
      {
        id: BUILTIN_ID,
        name: 'Format dasar SOAP',
        body: DEFAULT_TEMPLATE_BODY,
        isDefault: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );
}

export function createTemplate(
  uid: string,
  input: { name: string; body: string },
): { id: string; written: Promise<void> } {
  const id = nanoid(12);
  return {
    id,
    written: trackWrite(
      setDoc(templateDoc(uid, id), {
        id,
        name: input.name.trim(),
        body: input.body,
        isDefault: false,
        updatedAt: serverTimestamp(),
      }),
    ),
  };
}

export function updateTemplate(
  uid: string,
  templateId: string,
  patch: Partial<Pick<SoapTemplate, 'name' | 'body' | 'isDefault'>>,
): Promise<void> {
  return trackWrite(
    updateDoc(templateDoc(uid, templateId), { ...patch, updatedAt: serverTimestamp() }),
  );
}

export function subscribeTemplates(
  uid: string,
  callback: (templates: SoapTemplate[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    templatesCol(uid),
    (snapshot) => callback(snapshot.docs.map((entry) => entry.data() as SoapTemplate)),
    onError,
  );
}
