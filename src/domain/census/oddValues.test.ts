import { expect, it } from 'vitest';

import { oddValues } from './oddValues';

it('marks the one view that disagrees', () => {
  const values = ['room 404 bed 2', 'room 404 bed 2', 'room 404 bed 2', 'room 402 bed 2'];
  expect([...oddValues(values)]).toEqual(['room 402 bed 2']);
});

it('marks nothing when every view agrees', () => {
  expect(oddValues(['A', 'A']).size).toBe(0);
});

it('marks nothing on a tie: there is no telling which side is wrong', () => {
  expect(oddValues(['A', 'A', 'B', 'B']).size).toBe(0);
  expect(oddValues(['A', 'B']).size).toBe(0);
});

it('with a clear majority, every minority value is marked', () => {
  expect([...oddValues(['A', 'A', 'A', 'B', 'C'])].sort()).toEqual(['B', 'C']);
});
