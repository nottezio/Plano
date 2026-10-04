// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ResizeGrip } from '@/components/common/ResizeGrip';
import { FloatingCalculator } from './FloatingCalculator';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no matchMedia. A laptop: wide, with a fine pointer.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  window.localStorage.clear();
});

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

async function mount(node: ReturnType<typeof createElement>): Promise<HTMLElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(node));
  return host;
}

/** Type into a React-controlled input the way a browser does. */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const press = (element: Element): Promise<void> =>
  act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

const button = (scope: ParentNode, name: string): HTMLButtonElement => {
  const found = [...scope.querySelectorAll('button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  );
  if (!found) throw new Error(`no button "${name}"`);
  return found;
};

const field = (scope: ParentNode): HTMLInputElement =>
  scope.querySelector('input[aria-label="Hitungan"]') as HTMLInputElement;

test('shows the live result and how the line was read', async () => {
  const view = await mount(createElement(FloatingCalculator, { onClose: () => undefined }));
  await type(field(view), '12.000 + 3.000');
  expect(view.textContent).toContain('= 15000');
  // The Indonesian thousands dot is read as thousands, and says so.
  expect(view.textContent).toContain('Dibaca: 12000 + 3000');
});

test('keypad builds the line, Hitung hasil commits it and keeps the chain going', async () => {
  const view = await mount(createElement(FloatingCalculator, { onClose: () => undefined }));
  for (const key of ['8', '4', '÷', '2']) await press(button(view, key));
  expect(field(view).value).toBe('84÷2');
  await press(button(view, 'Hitung hasil'));
  // The result becomes the next line, and the step is on the tape.
  expect(field(view).value).toBe('42');
  expect(view.querySelector('ul[aria-label="Hasil sebelumnya"]')?.textContent).toContain('84 ÷ 2= 42');
});

test('says what is wrong instead of showing a wrong number', async () => {
  const view = await mount(createElement(FloatingCalculator, { onClose: () => undefined }));
  await type(field(view), '5 / 0');
  await press(button(view, 'Hitung hasil'));
  expect(view.querySelector('[role="alert"]')?.textContent).toBe('Tidak bisa dibagi nol.');
  expect(field(view).value).toBe('5 / 0');
  expect(view.querySelector('ul[aria-label="Hasil sebelumnya"]')).toBeNull();
});

test('is not modal, and Escape closes it', async () => {
  const onClose = vi.fn();
  const view = await mount(createElement(FloatingCalculator, { onClose }));
  const panel = view.querySelector('[role="dialog"]') as HTMLElement;
  expect(panel.getAttribute('aria-modal')).toBe('false');
  await act(async () => {
    field(view).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('folding hides the body but keeps the line, and is remembered', async () => {
  const view = await mount(createElement(FloatingCalculator, { onClose: () => undefined }));
  await type(field(view), '2 + 2');
  await press(button(view, 'Lipat kalkulator'));
  const stored = JSON.parse(window.localStorage.getItem('plano.floatCalc') ?? '{}') as {
    folded?: boolean;
  };
  expect(stored.folded).toBe(true);
  // Still mounted, so unfolding finds the line where it was left.
  expect(field(view).value).toBe('2 + 2');
  expect(view.textContent).toContain('= 4');
});

test('resize grip: arrows resize, Home resets, and it is a real separator', async () => {
  const sizes: number[] = [];
  const onReset = vi.fn();
  const view = await mount(
    createElement(ResizeGrip, {
      axis: 'y',
      label: 'Tinggi preview',
      getStart: () => 300,
      onChange: (next: number) => sizes.push(next),
      onReset,
    }),
  );
  const grip = view.querySelector('[role="separator"]') as HTMLElement;
  expect(grip.getAttribute('aria-orientation')).toBe('horizontal');
  expect(grip.tabIndex).toBe(0);
  const key = (name: string): Promise<void> =>
    act(async () => {
      grip.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    });
  await key('ArrowDown');
  await key('ArrowUp');
  await key('Home');
  expect(sizes).toEqual([332, 268]);
  expect(onReset).toHaveBeenCalledTimes(1);
});
