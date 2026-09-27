import { useEffect, useRef, useState } from 'react';

/**
 * What the field should show when a remote value arrives. Pure, so the three
 * cases the hook exists for are tested without a DOM.
 */
export function adoptRemote(input: {
  current: string;
  remote: string;
  lastRemote: string;
  pending: boolean;
  same?: (a: string, b: string) => boolean;
}): string {
  const same = input.same ?? ((a: string, b: string) => a === b);
  if (input.remote === input.lastRemote) return input.current; // not a change
  if (input.pending) return input.current; // local typing wins until sent
  return same(input.current, input.remote) ? input.current : input.remote;
}

/**
 * A text field backed by a synced value, without the snapshot fighting the
 * keyboard.
 *
 * The field is local state. Typing schedules a write after `delayMs`. A value
 * arriving from elsewhere is adopted only when (a) it actually CHANGED since
 * the last one seen and (b) nothing typed here is still waiting to be sent —
 * so the echo of this device's own write is a no-op, an older snapshot that
 * lands between the write and its echo cannot roll the field back, and an
 * edit made on the phone does show up on an idle PC.
 *
 * A pending write is flushed on unmount (switching date or tab), not dropped.
 * Give the caller a `key` per document so a new date starts a new draft.
 */
export function useSyncedDraft(
  remote: string,
  write: (value: string) => void,
  delayMs = 500,
  /**
   * When the stored form differs from the typed one (a list whose blank
   * lines are dropped), whether a remote value says the same as the field.
   * Without it, the echo of "a⏎" arriving as "a" would eat the line break
   * being typed.
   */
  same: (a: string, b: string) => boolean = (a, b) => a === b,
): [string, (value: string) => void] {
  const [value, setValue] = useState(remote);
  const lastRemote = useRef(remote);
  const pending = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const writeRef = useRef(write);
  writeRef.current = write;

  useEffect(() => {
    const previous = lastRemote.current;
    lastRemote.current = remote;
    const hasPending = pending.current !== null;
    setValue((current) =>
      adoptRemote({ current, remote, lastRemote: previous, pending: hasPending, same }),
    );
    // `same` is a pure comparison; a new closure each render is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (pending.current !== null) writeRef.current(pending.current);
    },
    [],
  );

  const change = (next: string): void => {
    setValue(next);
    pending.current = next;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const out = pending.current;
      pending.current = null;
      if (out !== null) writeRef.current(out);
    }, delayMs);
  };

  return [value, change];
}
