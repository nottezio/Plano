import { describe, expect, it } from 'vitest';

import { readFlows } from '@/domain/format/soapCheck';
import { calculateFluidBalance } from './fluidBalance';

const BASE = {
  intake: [
    { label: 'oral', ml: 500 },
    { label: 'IV', ml: 1500 },
    { label: 'lain', ml: null },
  ],
  output: [
    { label: 'urine', ml: 1500 },
    { label: 'lain', ml: 200 },
  ],
  hours: 24,
};

describe('calculateFluidBalance', () => {
  it('is input minus output, with the line to paste', () => {
    const result = calculateFluidBalance(BASE);
    expect(result?.balanceMl).toBe(300);
    expect(result?.line).toBe('Balance cairan 24 jam: input 2000 cc (oral 500, IV 1500) - output 1700 cc (urine 1500, lain 200) = +300 cc');
  });

  it('writes a negative balance with its sign', () => {
    expect(calculateFluidBalance({ ...BASE, hours: 6, output: [{ label: 'urine', ml: 2500 }] })?.line).toBe(
      'Balance cairan 6 jam: input 2000 cc (oral 500, IV 1500) - output 2500 cc = -500 cc',
    );
  });

  it('gives no balance from one side only: an unfilled side is not zero', () => {
    expect(calculateFluidBalance({ ...BASE, output: [{ label: 'urine', ml: null }] })).toBeNull();
    expect(calculateFluidBalance({ ...BASE, intake: [] })).toBeNull();
  });

  it('counts a typed zero as measured', () => {
    expect(calculateFluidBalance({ ...BASE, output: [{ label: 'urine', ml: 0 }] })?.balanceMl).toBe(2000);
  });

  it('refuses nonsense input', () => {
    expect(calculateFluidBalance({ ...BASE, hours: 0 })).toBeNull();
    expect(calculateFluidBalance({ ...BASE, intake: [{ label: 'oral', ml: Number.NaN }] })).toBeNull();
    expect(calculateFluidBalance({ ...BASE, intake: [{ label: 'oral', ml: -1 }] })).toBeNull();
  });

  it('writes a line the SOAP checker reads as a balance', () => {
    const line = calculateFluidBalance(BASE)?.line ?? '';
    expect(readFlows(line)['Balance']).toBeTruthy();
  });
});
