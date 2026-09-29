import { Timestamp } from 'firebase/firestore';
import { expect, it } from 'vitest';

import { reviveTimestamps } from './importData';

it('turns exported timestamps back into Timestamps, deep in the tree', () => {
  const out = reviveTimestamps({
    createdAt: { seconds: 100, nanoseconds: 5, type: 'firestore/timestamp/1.0' },
    list: [{ at: { seconds: 1, nanoseconds: 0 } }],
    other: { seconds: 1, nanoseconds: 0, label: 'not a timestamp' },
  }) as Record<string, unknown>;
  expect(out['createdAt']).toBeInstanceOf(Timestamp);
  expect(((out['list'] as unknown[])[0] as Record<string, unknown>)['at']).toBeInstanceOf(Timestamp);
  expect(out['other']).not.toBeInstanceOf(Timestamp);
});
