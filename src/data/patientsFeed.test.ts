import { afterEach, describe, expect, it, vi } from 'vitest';

const subscribe = vi.fn();
vi.mock('./repositories/patients.repo', () => ({
  subscribePatients: (...args: unknown[]) => subscribe(...args),
}));

const { acquirePatients, findCachedPatient, readPatients, resetPatientFeeds, watchPatients } =
  await import('./patientsFeed');

afterEach(() => {
  resetPatientFeeds();
  subscribe.mockReset();
  vi.useRealTimers();
});

function fakeQuery() {
  let push: ((snapshot: unknown) => void) | null = null;
  const unsubscribe = vi.fn();
  subscribe.mockImplementation((_uid: string, _status: string, onNext: (s: unknown) => void) => {
    push = onNext;
    return unsubscribe;
  });
  return {
    push: (ids: string[]) =>
      push?.({ patients: ids.map((id) => ({ id })), fromCache: true, hasPendingWrites: false }),
    unsubscribe,
  };
}

describe('patientsFeed', () => {
  it('a second visit reads the list already held — no loading, no second query', () => {
    const query = fakeQuery();
    const release = acquirePatients('u1', 'active');
    query.push(['a', 'b']);
    release();
    // The board is left and entered again.
    expect(readPatients('u1', 'active', true)).toMatchObject({ loading: false });
    expect(readPatients('u1', 'active', true).patients).toHaveLength(2);
    acquirePatients('u1', 'active');
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(query.unsubscribe).not.toHaveBeenCalled();
  });

  it('notifies watchers and finds a patient for an instant chart', () => {
    const query = fakeQuery();
    acquirePatients('u1', 'active');
    const seen = vi.fn();
    watchPatients('u1', 'active', seen);
    query.push(['p9']);
    expect(seen).toHaveBeenCalled();
    expect(findCachedPatient('u1', 'p9')).toEqual({ id: 'p9' });
    expect(findCachedPatient('u2', 'p9')).toBeNull();
  });

  it('other lists linger a few minutes, then stop', () => {
    vi.useFakeTimers();
    const query = fakeQuery();
    const release = acquirePatients('u1', 'archived');
    release();
    vi.advanceTimersByTime(60_000);
    expect(query.unsubscribe).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5 * 60_000);
    expect(query.unsubscribe).toHaveBeenCalled();
  });

  it('a different account drops the previous one', () => {
    const first = fakeQuery();
    acquirePatients('u1', 'active');
    fakeQuery();
    acquirePatients('u2', 'active');
    expect(first.unsubscribe).toHaveBeenCalled();
    expect(readPatients('u1', 'active', true).loading).toBe(true);
  });
});
