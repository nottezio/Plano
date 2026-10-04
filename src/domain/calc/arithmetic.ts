/**
 * The floating calculator's arithmetic (2026-10-05).
 *
 * A small parser, not `eval`: the input is typed by a person in a clinical
 * app, and the only thing it may ever do is arithmetic.
 *
 * NUMBERS ARE READ THE WAY THE NOTES WRITE THEM. In this app `12.000` is
 * twelve thousand and `3,1` is three point one — Indonesian convention, as in
 * every lab line a resident pastes. A calculator that read `12.000` as twelve
 * would be wrong by a factor of a thousand on exactly the numbers it is opened
 * for. So:
 *
 * - `.` followed by exactly three digits is a thousands separator
 *   (`12.000`, `1.250.000`, `1.250,5`);
 * - a comma is always the decimal mark (`3,1`);
 * - a `.` with one or two digits after it is accepted as a decimal mark
 *   (`3.1`, `0.75`), because that is what a phone keypad types.
 *
 * The one real ambiguity is `1.500`, which is read as 1500. `read` — the
 * expression as it was understood — is returned with every result so the
 * panel can show "Dibaca: 1500 + 3000" and a misreading is visible instead of
 * silent.
 *
 * `%` is a plain postfix: `10%` is 0,1 and `200 × 10%` is 20. It is NOT the
 * phone-calculator rule where `200 + 10%` means 220, which depends on
 * context that a typed line does not carry.
 */

export type ArithmeticError = 'kosong' | 'sintaks' | 'bagi-nol' | 'terlalu-besar';

export type ArithmeticResult =
  | { ok: true; value: number; read: string }
  | { ok: false; reason: ArithmeticError };

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '^' | '%' | '(' | ')' };

const THOUSANDS = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?/;
const DECIMAL = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)/;

function parseNumber(text: string): number {
  // Thousands dots go; the comma becomes the decimal point.
  const cleaned = THOUSANDS.test(text) ? text.replace(/\./g, '') : text;
  return Number(cleaned.replace(',', '.'));
}

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let rest = input;
  while (rest.length > 0) {
    const ch = rest[0] as string;
    if (/\s/.test(ch)) {
      rest = rest.slice(1);
      continue;
    }
    const number = THOUSANDS.exec(rest) ?? DECIMAL.exec(rest);
    if (number) {
      tokens.push({ kind: 'num', value: parseNumber(number[0]) });
      rest = rest.slice(number[0].length);
      continue;
    }
    const op =
      ch === '×' || ch === 'x' || ch === 'X' || ch === '*'
        ? '*'
        : ch === '÷' || ch === '/' || ch === ':'
        ? '/'
        : ch === '−' || ch === '–' || ch === '-'
        ? '-'
        : ch === '+' || ch === '^' || ch === '%' || ch === '(' || ch === ')'
        ? ch
        : null;
    if (!op) return null;
    tokens.push({ kind: 'op', value: op });
    rest = rest.slice(1);
  }
  return tokens;
}

class Failure extends Error {
  constructor(readonly reason: ArithmeticError) {
    super(reason);
  }
}

/** The number as written back in `read`: no grouping, a comma for the decimal. */
function plain(value: number): string {
  return String(Number(value.toPrecision(12))).replace('.', ',');
}

export function evaluate(input: string): ArithmeticResult {
  if (input.trim() === '') return { ok: false, reason: 'kosong' };
  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return { ok: false, reason: 'sintaks' };

  let at = 0;
  const peek = (): Token | undefined => tokens[at];
  const isOp = (token: Token | undefined, ...values: string[]): boolean =>
    token?.kind === 'op' && values.includes(token.value);

  // expr := term (('+' | '-') term)*
  const expr = (): number => {
    let left = term();
    while (isOp(peek(), '+', '-')) {
      const op = (tokens[at++] as { value: string }).value;
      const right = term();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  // term := unary (('*' | '/') unary)*
  const term = (): number => {
    let left = unary();
    while (isOp(peek(), '*', '/')) {
      const op = (tokens[at++] as { value: string }).value;
      const right = unary();
      if (op === '/') {
        if (right === 0) throw new Failure('bagi-nol');
        left /= right;
      } else {
        left *= right;
      }
    }
    return left;
  };

  // unary := ('-' | '+') unary | power
  const unary = (): number => {
    if (isOp(peek(), '-')) {
      at++;
      return -unary();
    }
    if (isOp(peek(), '+')) {
      at++;
      return unary();
    }
    return power();
  };

  // power := postfix ('^' unary)?   (right-associative through `unary`)
  const power = (): number => {
    const base = postfix();
    if (isOp(peek(), '^')) {
      at++;
      return base ** unary();
    }
    return base;
  };

  // postfix := primary '%'*
  const postfix = (): number => {
    let value = primary();
    while (isOp(peek(), '%')) {
      at++;
      value /= 100;
    }
    return value;
  };

  const primary = (): number => {
    const token = tokens[at++];
    if (token?.kind === 'num') return token.value;
    if (isOp(token, '(')) {
      const inner = expr();
      if (!isOp(tokens[at++], ')')) throw new Failure('sintaks');
      return inner;
    }
    throw new Failure('sintaks');
  };

  try {
    const value = expr();
    if (at !== tokens.length) return { ok: false, reason: 'sintaks' };
    if (!Number.isFinite(value)) return { ok: false, reason: 'terlalu-besar' };
    const rounded = Number(value.toPrecision(12));
    return { ok: true, value: rounded === 0 ? 0 : rounded, read: readBack(tokens) };
  } catch (cause) {
    if (cause instanceof Failure) return { ok: false, reason: cause.reason };
    throw cause;
  }
}

/** The expression as understood, e.g. `12.000 + 3,5` → `12000 + 3,5`. */
function readBack(tokens: readonly Token[]): string {
  const symbol: Record<string, string> = { '*': '×', '/': '÷', '-': '−' };
  let out = '';
  tokens.forEach((token, index) => {
    const prev = tokens[index - 1];
    if (token.kind === 'num') {
      out += plain(token.value);
      return;
    }
    const value = token.value;
    if (value === '(') out += value;
    else if (value === ')' || value === '%' || value === '^') out += value;
    else {
      // A sign at the start, or after an operator or "(", sits against its operand.
      const sign =
        (value === '-' || value === '+') &&
        (!prev || (prev.kind === 'op' && prev.value !== ')' && prev.value !== '%'));
      out += sign ? (symbol[value] ?? value) : ` ${symbol[value] ?? value} `;
    }
  });
  return out;
}

/**
 * A result as a resident writes it: comma decimal, no grouping, trimmed.
 * Six decimals is more than any bedside number needs and keeps `1 ÷ 3` short.
 */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
  if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-6 && value !== 0)) {
    return value.toExponential(6).replace(/\.?0+e/, 'e').replace('.', ',');
  }
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

export const ARITHMETIC_ERROR_TEXT: Record<ArithmeticError, string> = {
  kosong: 'Ketik hitungan dulu.',
  sintaks: 'Hitungan belum lengkap atau ada karakter yang tidak dikenal.',
  'bagi-nol': 'Tidak bisa dibagi nol.',
  'terlalu-besar': 'Hasilnya terlalu besar.',
};
