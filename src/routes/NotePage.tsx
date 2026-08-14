import { useCallback } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { updateProfileNote } from '@/data/repositories/settings.repo';
import { useTextSync } from '@/hooks/useTextSync';
import { useSession } from '@/store/useSession';

/**
 * A single scratch note, for the user rather than for a patient.
 *
 * One note, not a list. Everything about it — no title, no create button, no
 * navigation — exists so that opening the tab puts a cursor in text you were
 * already writing. A list would make you choose a note before you could write
 * in one, which is the friction this is meant to remove.
 *
 * It is deliberately NOT a patient note and NOT a document: no copy formats, no
 * sections, nothing that ends up in a handover. Things you want to remember,
 * not things you will send.
 *
 * Durability is the same machinery as a SOAP body — same debounce, same
 * force-flush on blur and backgrounding, same three-way merge across devices.
 */
export default function NotePage(): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const profile = useSession((state) => state.profile);

  const write = useCallback(
    (note: string) => (uid ? updateProfileNote(uid, note) : Promise.resolve()),
    [uid],
  );

  const sync = useTextSync({
    key: `scratch|${uid ?? 'none'}`,
    serverText: profile?.scratchNote ?? '',
    locked: uid === null,
    write,
  });

  return (
    <AppShell title="Catatan">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-3">
        <textarea
          value={sync.value}
          onChange={(event) => sync.setValue(event.target.value)}
          onBlur={sync.flush}
          spellCheck
          placeholder="Catatan untuk diri sendiri…"
          className="min-h-[60vh] w-full flex-1 resize-none break-words border-0 bg-transparent text-[15px] leading-7 outline-none placeholder:text-fg-faint"
        />
        <p className="py-2 text-[11px] text-fg-faint">
          {sync.dirty ? 'Menyimpan…' : 'Tersimpan'} · Hanya untuk Anda, tidak ikut tersalin
          ke laporan.
        </p>
      </div>
    </AppShell>
  );
}
