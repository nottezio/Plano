// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test } from 'vitest';

import { ChoiceChip } from './ui';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(active: boolean): Promise<HTMLButtonElement> {
  const host = document.createElement('div');
  await act(async () =>
    createRoot(host).render(createElement(ChoiceChip, { active, onClick: () => undefined, children: 'Terapi + TS' })),
  );
  return host.querySelector('button') as HTMLButtonElement;
}

/*
  A chip that changed width when pressed moved every chip after it in the row
  (Salin → Bagian). jsdom cannot measure, so this pins the structure that
  makes the width state-independent: an invisible sizing layer in the widest
  state (check + semibold), present whether or not the chip is active.
*/
test.each([false, true])('the sizing layer is identical when active=%s', async (active) => {
  const chip = await render(active);
  const sizer = chip.querySelector('span[aria-hidden="true"]') as HTMLElement;
  expect(sizer.className).toContain('invisible');
  expect(sizer.className).toContain('font-semibold');
  expect(sizer.querySelector('svg')).not.toBeNull();
  expect(sizer.textContent).toBe('Terapi + TS');
  // Both layers share one grid cell, so the visible one never adds width.
  const visible = chip.querySelector('span:not([aria-hidden])') as HTMLElement;
  expect(visible.className).toContain('col-start-1 row-start-1');
  expect(sizer.className).toContain('col-start-1 row-start-1');
  expect(visible.querySelector('svg') !== null).toBe(active);
  expect(chip.getAttribute('aria-pressed')).toBe(String(active));
});
