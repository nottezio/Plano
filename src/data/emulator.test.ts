import { describe, expect, it } from 'vitest';

import { EMULATOR_CONFIG, isEmulatorMode } from './emulator';

describe('isEmulatorMode', () => {
  it('is on only for the emulator mode on a loopback host', () => {
    expect(isEmulatorMode('emulator', 'localhost')).toBe(true);
    expect(isEmulatorMode('emulator', '127.0.0.1')).toBe(true);
  });

  it('is off in every other mode, so production and dev never connect', () => {
    for (const mode of ['production', 'development', 'test']) {
      expect(isEmulatorMode(mode, 'localhost')).toBe(false);
    }
  });

  it('is off on a real host even in emulator mode', () => {
    expect(isEmulatorMode('emulator', 'plano.example.com')).toBe(false);
  });

  it('uses a demo- project so the emulators cannot reach a real one', () => {
    expect(EMULATOR_CONFIG.projectId.startsWith('demo-')).toBe(true);
  });
});
