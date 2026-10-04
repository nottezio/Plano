import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { Button, Callout, ListGroup, ListRow, Section } from '@/components/common/ui';
import {
  expandOpeningTokens,
  findOpeningLine,
  replaceClosing,
  toDokterForm,
  toProfForm,
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
  closingSentences,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  body: string;
  greetings: readonly string[];
  openingSentences: readonly string[];
  closingSentences: readonly string[];
  onApply: (nextBody: string) => void;
}): JSX.Element {
  /*
    Tokens are resolved ONCE per open, against one timestamp.

    Once, so that the greeting and the date in the sentence below it cannot
    come from two different readings of the clock — a sheet left open across
    midnight would otherwise offer "selamat malam" beside tomorrow's date.

    `now` is the moment the sheet opened rather than the note's clinical day.
    These lines are the message being sent, and the message is being sent now;
    a back-dated note still goes out today.
  */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (open) setNow(new Date());
  }, [open]);
  const resolvedGreetings = useMemo(
    () => greetings.map((greeting) => expandOpeningTokens(greeting, now)),
    [greetings, now],
  );
  const resolvedSentences = useMemo(
    () => openingSentences.map((sentence) => expandOpeningTokens(sentence, now)),
    [openingSentences, now],
  );

  const line = findOpeningLine(body);
  const current = line ? splitOpening(line.text) : { greeting: '', rest: '' };
  const suggested =
    resolvedGreetings[suggestGreetingIndex(resolvedGreetings, now.getHours())];

  const closingNow = body.trimEnd();

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Pembuka & penutup"
      description="Mengubah baris pertama dan kalimat penutup saja. Isi SOAP di antaranya tidak tersentuh."
    >
      <div className="space-y-6">
        {/* What is there now, so a tap below reads as a change to something. */}
        <Callout title="Baris pembuka saat ini">
          {line ? (
            <span className="text-fg">{line.text}</span>
          ) : (
            <span className="italic">Belum ada baris pembuka — pilihan di bawah menambahkannya.</span>
          )}
        </Callout>

        <Section title="Salam">
          <ListGroup>
            {resolvedGreetings.map((greeting) => {
              const active = current.greeting === greeting;
              return (
                <ListRow
                  key={greeting}
                  title={greeting}
                  selected={active}
                  {...(greeting === suggested && !active ? { badge: 'sesuai jam' } : {})}
                  onClick={() => onApply(replaceGreeting(body, greeting))}
                />
              );
            })}
          </ListGroup>
        </Section>

        <Section
          title="Kalimat pembuka"
          hint="Ruang, kamar, bed, dan poli diisi manual: ini hanya kerangka kalimatnya. Tambah atau ubah di Pengaturan → Format catatan."
        >
          <ListGroup>
            {resolvedSentences.map((sentence) => (
              <ListRow
                key={sentence}
                title={<span className="font-normal leading-snug">{sentence}</span>}
                selected={current.rest === sentence}
                onClick={() => onApply(replaceOpeningSentence(body, sentence))}
              />
            ))}
          </ListGroup>
        </Section>

        <Section
          title="Sapaan"
          hint="Mengganti sapaan di paragraf pembuka dan kalimat penutup sekaligus. Gelar dan nama (Prof. dr. …, baris DPJP) serta isi SOAP tidak berubah."
        >
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onApply(toProfForm(body))}>Ganti ke Prof</Button>
            <Button onClick={() => onApply(toDokterForm(body))}>Ganti ke dokter</Button>
          </div>
        </Section>

        <Section
          title="Kalimat penutup"
          hint="Mengganti baris penutup yang ada. Bila belum ada penutup, kalimat ditambahkan di bawah tanpa menghapus apa pun."
        >
          <ListGroup>
            {closingSentences.map((closing) => (
              <ListRow
                key={closing}
                title={<span className="font-normal leading-snug">{closing}</span>}
                selected={closingNow.endsWith(closing.trim())}
                onClick={() => onApply(replaceClosing(body, closing))}
              />
            ))}
          </ListGroup>
        </Section>
      </div>
    </Sheet>
  );
}
