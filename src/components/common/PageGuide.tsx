import { useEffect, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { Button } from '@/components/common/ui';
import { boldRuns, readGuideSeen, writeGuideSeen, type GuideStep } from '@/domain/guides/guide';

const storage = (): Storage | undefined => (typeof window === 'undefined' ? undefined : window.localStorage);

function Rich({ text }: { text: string }): JSX.Element {
  return (
    <>
      {boldRuns(text).map((run, i) =>
        run.bold ? (
          <strong key={i} className="font-semibold text-fg">
            {run.text}
          </strong>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

/**
 * A first-time guide (Panduan, 2 Nov 2026): opens by itself the first time
 * `ready` is true on this device; any close (Mulai pakai, Lewati, ✕, back)
 * marks `storageKey` seen. `requested` reopens it, at the first step.
 */
export function PageGuide({
  title,
  steps,
  storageKey,
  ready,
  requested,
  onRequestHandled,
}: {
  title: string;
  steps: readonly GuideStep[];
  storageKey: string;
  /** The page is on screen: never opens over a loading page or a setup form. */
  ready: boolean;
  requested: boolean;
  onRequestHandled: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (ready && !readGuideSeen(storage(), storageKey)) setOpen(true);
  }, [ready, storageKey]);

  useEffect(() => {
    if (!requested) return;
    setIndex(0);
    setOpen(true);
    onRequestHandled();
  }, [requested, onRequestHandled]);

  const close = (): void => {
    writeGuideSeen(storage(), storageKey);
    setOpen(false);
    setIndex(0);
  };

  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return <></>;
  const last = index >= steps.length - 1;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title={title}
      description={`Langkah ${index + 1} dari ${steps.length}`}
      footer={
        <div className="flex items-center gap-2">
          {index === 0 ? (
            <Button variant="quiet" onClick={close}>
              Lewati
            </Button>
          ) : (
            <Button onClick={() => setIndex(index - 1)}>Kembali</Button>
          )}
          <div aria-hidden="true" className="flex flex-1 justify-center gap-1.5">
            {steps.map((s, i) => (
              <span key={s.id} className={`h-1.5 rounded-full transition-[width] ${i === index ? 'w-4 bg-accent' : 'w-1.5 bg-border'}`} />
            ))}
          </div>
          <Button variant="primary" onClick={() => (last ? close() : setIndex(index + 1))}>
            {last ? 'Mulai pakai' : 'Lanjut'}
          </Button>
        </div>
      }
    >
      <section aria-live="polite" className="space-y-3">
        <h3 className="text-base font-semibold text-fg">{step.title}</h3>
        <p className="text-sm leading-relaxed text-fg-muted">
          <Rich text={step.lead} />
        </p>
        <ol className="space-y-2">
          {step.points.map((point, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-fg-muted">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-[11px] font-semibold tabular-nums text-fg">
                {i + 1}
              </span>
              <span>
                <Rich text={point} />
              </span>
            </li>
          ))}
        </ol>
      </section>
    </Sheet>
  );
}
