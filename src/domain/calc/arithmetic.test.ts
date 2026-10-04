import { describe, expect, it } from 'vitest';

import { evaluate, formatResult } from './arithmetic';

const value = (input: string): number | string => {
  const result = evaluate(input);
  return result.ok ? result.value : result.reason;
};

describe('evaluate: arithmetic', () => {
  it('follows precedence and parentheses', () => {
    expect(value('2 + 3 × 4')).toBe(14);
    expect(value('(2 + 3) × 4')).toBe(20);
    expect(value('100 ÷ 4 ÷ 5')).toBe(5);
    expect(value('10 - 4 - 3')).toBe(3);
  });

  it('accepts the operator spellings people type', () => {
    expect(value('6 x 7')).toBe(42);
    expect(value('6 * 7')).toBe(42);
    expect(value('84 / 2')).toBe(42);
    expect(value('84 : 2')).toBe(42);
    expect(value('5 − 2')).toBe(3);
  });

  it('handles unary signs and powers', () => {
    expect(value('-5 + 8')).toBe(3);
    expect(value('2 × -3')).toBe(-6);
    expect(value('2 ^ 3 ^ 2')).toBe(512);
    expect(value('--4')).toBe(4);
  });

  it('keeps floating point noise out of the result', () => {
    expect(value('0,1 + 0,2')).toBe(0.3);
    expect(value('1,1 × 3')).toBe(3.3);
  });

  it('reads % as a plain postfix', () => {
    expect(value('10%')).toBe(0.1);
    expect(value('200 × 10%')).toBe(20);
    // Not the phone-calculator rule.
    expect(value('200 + 10%')).toBe(200.1);
  });

  it('never returns negative zero', () => {
    expect(Object.is(value('0 × -1'), 0)).toBe(true);
  });
});

describe('evaluate: Indonesian number notation', () => {
  it('reads a dot with three digits as thousands', () => {
    expect(value('12.000')).toBe(12000);
    expect(value('1.250.000')).toBe(1250000);
    expect(value('12.000 + 3.000')).toBe(15000);
  });

  it('reads a comma as the decimal mark, alone or after thousands', () => {
    expect(value('3,1')).toBe(3.1);
    expect(value('1.250,5')).toBe(1250.5);
    expect(value(',5 + ,25')).toBe(0.75);
  });

  it('accepts a dot with one or two digits as a decimal mark', () => {
    expect(value('3.1')).toBe(3.1);
    expect(value('0.75 × 4')).toBe(3);
  });

  it('echoes how the line was read, so a misreading is visible', () => {
    const result = evaluate('1.500 + 3,5');
    expect(result.ok && result.read).toBe('1500 + 3,5');
    const signed = evaluate('-2 × (3 + 4)%');
    expect(signed.ok && signed.read).toBe('−2 × (3 + 4)%');
  });
});

describe('evaluate: errors', () => {
  it('says what is wrong rather than guessing', () => {
    expect(value('')).toBe('kosong');
    expect(value('   ')).toBe('kosong');
    expect(value('5 +')).toBe('sintaks');
    expect(value('(2 + 3')).toBe('sintaks');
    expect(value('2 3')).toBe('sintaks');
    expect(value('2 + a')).toBe('sintaks');
    expect(value('5 ÷ 0')).toBe('bagi-nol');
    expect(value('5 ÷ (2 - 2)')).toBe('bagi-nol');
    expect(value('9 ^ 999')).toBe('terlalu-besar');
  });

  it('is not eval', () => {
    expect(value('alert(1)')).toBe('sintaks');
    expect(value('2 ** 3')).toBe('sintaks');
    expect(value('constructor')).toBe('sintaks');
  });
});

describe('formatResult', () => {
  it('writes comma decimals, trimmed, with no grouping', () => {
    expect(formatResult(15000)).toBe('15000');
    expect(formatResult(3.5)).toBe('3,5');
    expect(formatResult(1 / 3)).toBe('0,333333');
    expect(formatResult(-0.25)).toBe('-0,25');
    expect(formatResult(2.0000001)).toBe('2');
  });
});
