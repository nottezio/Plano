import { type ReactNode } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { HeparinCard } from '@/components/calc/HeparinCard';
import { WarfarinCard } from '@/components/calc/WarfarinCard';
import {
  LinkCard,
  OsmolalityCard,
  SodiumGlucoseCard,
  UnitConverterCard,
  UrineOutputCard,
} from '@/components/calc/ClinicalCards';

/**
 * Sodium and potassium REPLACEMENT and syringe-pump rates are links, not cards.
 *
 * Both were once domain helpers here and wrong in turn; a dose has to match a
 * protocol only the ward owns. ElektroCalc and InfuCalc are Avicenna's own
 * tools and stay the source of truth for any dose.
 */
const ELECTROLYTE_CALCULATOR_URL = 'https://nottezio.github.io/elektrocalc/';
const INFUSION_CALCULATOR_URL = 'https://nottezio.github.io/infucalc/';

/**
 * Bedside calculations (revamped 2026-10-01).
 *
 * Grouped by what they are for, with a jump bar, two columns on a laptop.
 * Every card has the same shape — title, the formula, inputs, a result block
 * with a line to paste, and a "Rujukan" list naming where each formula and
 * cut-off comes from. A calculation with no citation does not belong here.
 *
 * Nothing is stored: a calculation is a scratch step on the way to a line of
 * text, and a history would be numbers with no patient attached.
 */
const GROUPS = [
  { id: 'calc-cairan', label: 'Ginjal & cairan' },
  { id: 'calc-antikoagulan', label: 'Antikoagulan' },
  { id: 'calc-elektrolit', label: 'Elektrolit' },
  { id: 'calc-konversi', label: 'Konversi satuan' },
  { id: 'calc-alat', label: 'Lainnya' },
] as const;

export default function CalculatorPage(): JSX.Element {
  return (
    <AppShell title="Kalkulator">
      <div className="mx-auto w-full max-w-5xl px-4 pb-8">
        <nav
          aria-label="Kelompok kalkulator"
          className="sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-border bg-bg px-4 py-2"
        >
          <ul className="flex w-max gap-2">
            {GROUPS.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(group.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="min-h-tap whitespace-nowrap rounded-full border border-border bg-surface px-3 text-sm text-fg-muted [@media(pointer:fine)]:min-h-8"
                >
                  {group.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <Group id="calc-cairan" label="Ginjal & cairan">
          <UrineOutputCard />
          <OsmolalityCard />
        </Group>

        <Group id="calc-antikoagulan" label="Antikoagulan">
          <HeparinCard />
          <WarfarinCard />
        </Group>

        <Group id="calc-elektrolit" label="Elektrolit">
          <SodiumGlucoseCard />
          <LinkCard
            title="Koreksi natrium & kalium"
            subtitle="Defisit, dosis dan laju koreksi: ElektroCalc, sesuai protokol bangsal."
            href={ELECTROLYTE_CALCULATOR_URL}
            label="Buka ElektroCalc"
          />
        </Group>

        <Group id="calc-konversi" label="Konversi satuan">
          <UnitConverterCard />
        </Group>

        <Group id="calc-alat" label="Lainnya">
          <LinkCard
            title="Laju syringe pump"
            subtitle="InfuCalc — kalkulator laju infus dan syringe pump."
            href={INFUSION_CALCULATOR_URL}
            label="Buka InfuCalc"
          />
        </Group>

        <p className="mt-6 px-1 text-[11px] text-fg-faint">
          Hasil tidak disimpan — salin barisnya ke catatan. Setiap rumus dan ambang memakai
          rujukan yang tertulis di kartunya.
        </p>
      </div>
    </AppShell>
  );
}

function Group({ id, label, children }: { id: string; label: string; children: ReactNode }): JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-16 pt-5">
      <h2 id={`${id}-h`} className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </h2>
      <div className="grid items-start gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}
