// @vitest-environment jsdom
import { expect, it } from 'vitest';

import { clearDeviceUserState } from './deviceUserState';

it('clears every per-person key and keeps the device ones (audit 2026-09-29)', () => {
  localStorage.setItem('visite.pin', 'x');
  localStorage.setItem('visite.ai.key', 'x');
  localStorage.setItem('visite.ai.flags', 'x');
  localStorage.setItem('visite.boardCanvasLayout', 'x');
  localStorage.setItem('visite.deviceId', 'device');
  localStorage.setItem('visite.theme', 'dark');
  localStorage.setItem('other.app', 'keep');
  sessionStorage.setItem('plano.clipboard.last', 'x');
  clearDeviceUserState();
  expect(localStorage.getItem('visite.pin')).toBeNull();
  expect(localStorage.getItem('visite.ai.key')).toBeNull();
  expect(localStorage.getItem('visite.ai.flags')).toBeNull();
  expect(localStorage.getItem('visite.boardCanvasLayout')).toBeNull();
  expect(sessionStorage.getItem('plano.clipboard.last')).toBeNull();
  expect(localStorage.getItem('visite.deviceId')).toBe('device');
  expect(localStorage.getItem('visite.theme')).toBe('dark');
  expect(localStorage.getItem('other.app')).toBe('keep');
});
