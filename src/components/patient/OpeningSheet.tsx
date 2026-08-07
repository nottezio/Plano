import { Sheet } from '@/components/common/Sheet';
import {
  findOpeningLine,
  replaceGreeting,
  replaceOpeningSentence,
  splitOpening,
  suggestGreetingIndex,
} from '@/domain/opening';

/**
 * SPEC 14 — swap the greeting or the reporting sentence on a note that already
 * exists.
 *
 * Two independent lists, because they change for different reasons: the
 * greeting depends on the time of day and on who is reading it, the reporting
 * sentence on why this patient is being presented. Bundling them would mean
 * picking a new greeting silently rewrote where the patient came from.
 *
 * Both operations rewrite AT MOST the first non-empty line. Everything below is
 * byte-identical afterwards, which is what makes this safe to offer halfway
 * through writing.
 */
export function OpeningSheet({
  open,
  onOpenChange,
  body,
  greetings,
  openingSentences,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  body: string;
  greetings: readonly string[];
  openingSentences: readonly string[];
  onApply: (nextBody: string) => void;
}): JSX.Element {
  const line = findOpeningLine(body);
  const current = line ? splitOpening(line.text) : { greeting: '', rest: '' };
  const suggested = greetings[suggestGreetingIndex(greetings, new Date().getHours())];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Kalimat pembuka"
      description="Hanya baris pertama yang diubah. Isi catatan di bawahnya tidak tersentuh."
    >
      <section>
        <h3 className="text-xs font-medium text-fg-muted">Salam</h3>
        <div className="mt-1.5 space-y-1.5">
          {greetings.map((greeting) => {
            const active = current.greeting === greeting;
            return (
              <button
                key={greeting}
                type="button"
                aria-pressed={active}
                onClick={() => onApply(replaceGreeting(body, greeting))}
                className={[
                  'flex min-h-tap w-full items-center gap-2 rounded-lg border px-3 text-left text-sm',
                  active
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg',
                ].join(' ')}
              >
                <span className="min-w-0 flex-1 py-2">{greeting}</span>
                {greeting === suggested && !active ? (
                  <span className="shrink-0 text-[11px] text-fg-faint">sesuai jam</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5">
        <h3 className="text-xs font-medium text-fg-muted">Kalimat pembuka</h3>
        <div className="mt-1.5 space-y-1.5">
          {openingSentences.map((sentence) => {
            const active = current.rest === sentence;
            return (
              <button
                key={sentence}
                type="button"
                aria-pressed={active}
                onClick={() => onApply(replaceOpeningSentence(body, sentence))}
                className={[
                  'w-full rounded-lg border px-3 py-2.5 text-left text-xs leading-relaxed',
                  active
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg',
                ].join(' ')}
              >
                {sentence}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-fg-faint">
          Ruang, kamar, bed, dan poli tetap diisi manual — daftar ini hanya kerangka
          kalimatnya. Tambah atau ubah di Pengaturan → Format catatan.
        </p>
      </section>
    </Sheet>
  );
}
