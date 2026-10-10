import { useState } from 'react';

import { TARGET_HIGH_CHOICES, type TargetHigh } from '@/domain/calc/heparinProtocol';

const KEY = 'visite.heparin';

/**
 * The lab's aPTT control and the target the ward uses (2026-10-10).
 *
 * On this device, like the reference ranges: both are properties of a lab
 * and a protocol, not of a patient, and nothing here is synced or stored per
 * patient. Empty control is a valid state — the card then asks for it.
 */
export interface HeparinSettings {
  control: number | null;
  targetHigh: TargetHigh;
}

export function readHeparinSettings(): HeparinSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Record<string, unknown>> | null;
    const control = Number(parsed?.['control']);
    const high = Number(parsed?.['targetHigh']);
    return {
      control: Number.isFinite(control) && control > 0 ? control : null,
      targetHigh: high === 2.5 ? 2.5 : 2.3,
    };
  } catch {
    return { control: null, targetHigh: 2.3 };
  }
}

function save(next: HeparinSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[heparin] settings not saved', error);
  }
}

export function HeparinSettingsEditor(): JSX.Element {
  const [settings, setSettings] = useState(readHeparinSettings);
  const [controlText, setControlText] = useState(settings.control?.toString() ?? '');
  const update = (next: HeparinSettings): void => {
    setSettings(next);
    save(next);
  };
  return (
    <div className="space-y-3 text-xs">
      <label className="flex flex-wrap items-center gap-2">
        <span className="min-w-[9rem] text-fg-muted">aPTT kontrol lab (detik)</span>
        <input
          inputMode="decimal"
          value={controlText}
          onChange={(event) => {
            const text = event.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
            setControlText(text);
            const value = Number(text);
            update({ ...settings, control: text && Number.isFinite(value) && value > 0 ? value : null });
          }}
          placeholder="mis. 30"
          className="min-h-tap w-24 rounded-lg border border-border bg-surface px-2 text-xs"
        />
      </label>
      <p className="text-fg-faint">
        Raschke 1993 memakai batas atas rentang normal aPTT lab sebagai kontrol. Bila hasil lab mencetak nilai kontrol, kartu
        memakai angka itu.
      </p>
      <div>
        <p className="mb-1 text-fg-muted">Target aPTT</p>
        <div role="group" aria-label="Target aPTT" className="flex flex-col gap-1 sm:flex-row">
          {TARGET_HIGH_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={settings.targetHigh === choice.value}
              onClick={() => update({ ...settings, targetHigh: choice.value })}
              className={[
                'min-h-tap flex-1 rounded-lg border px-2 text-left',
                settings.targetHigh === choice.value ? 'border-accent font-semibold text-accent' : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-fg-faint">
          1,5–2,5 hanya menggeser batas baris "tanpa perubahan" dan "turunkan 2"; baris lain tetap sesuai Raschke 1993.
        </p>
      </div>
    </div>
  );
}
