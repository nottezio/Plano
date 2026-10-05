import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { installBootAuthCap } from './bootAuthCap';

const realFetch = globalThis.fetch;
let calls: string[] = [];
let answer: (url: string) => Promise<Response>;

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  answer = () => new Promise<Response>(() => undefined); // never answers
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    return answer(url);
  }) as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
});

const LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=k';
const REFRESH = 'https://securetoken.googleapis.com/v1/token?key=k';
const FIRESTORE = 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen';

test('a hung account check fails as a network error after the cap', async () => {
  const cap = installBootAuthCap(3000);
  const result = globalThis.fetch(LOOKUP).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(2999);
  expect(cap.capped()).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toBeInstanceOf(TypeError);
  expect(cap.capped()).toBe(true);
});

test('the token refresh host is capped too', async () => {
  const cap = installBootAuthCap(100);
  const result = globalThis.fetch(REFRESH).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toBeInstanceOf(TypeError);
  expect(cap.capped()).toBe(true);
});

test('a prompt answer passes through untouched', async () => {
  answer = () => Promise.resolve(new Response('{"users":[]}', { status: 200 }));
  const cap = installBootAuthCap(3000);
  const response = await globalThis.fetch(LOOKUP);
  expect(response.status).toBe(200);
  await vi.advanceTimersByTimeAsync(5000);
  expect(cap.capped()).toBe(false);
});

test('a real error answer from Google is NOT turned into a network error', async () => {
  // USER_DISABLED must still sign the account out.
  answer = () => Promise.resolve(new Response('{"error":{"message":"USER_DISABLED"}}', { status: 400 }));
  installBootAuthCap(3000);
  const response = await globalThis.fetch(LOOKUP);
  expect(response.status).toBe(400);
});

test('other hosts are never capped: Firestore may take as long as it needs', async () => {
  const cap = installBootAuthCap(100);
  let settled = false;
  void globalThis.fetch(FIRESTORE).finally(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(10_000);
  expect(settled).toBe(false);
  expect(cap.capped()).toBe(false);
});

test('released, it is gone: sign-in and later refreshes get no cap', async () => {
  const before = globalThis.fetch;
  const cap = installBootAuthCap(100);
  expect(globalThis.fetch).not.toBe(before);
  cap.release();
  expect(globalThis.fetch).toBe(before);
  cap.release(); // idempotent
  expect(globalThis.fetch).toBe(before);
});

test('released while something else wrapped fetch after it: passes through, cap off', async () => {
  const cap = installBootAuthCap(100);
  const ours = globalThis.fetch;
  const outer = ((input: RequestInfo | URL, init?: RequestInit) => ours(input, init)) as typeof fetch;
  globalThis.fetch = outer;
  cap.release();
  expect(globalThis.fetch).toBe(outer);
  let settled = false;
  void globalThis.fetch(LOOKUP).finally(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(10_000);
  expect(settled).toBe(false);
  expect(calls).toEqual([LOOKUP]);
});
