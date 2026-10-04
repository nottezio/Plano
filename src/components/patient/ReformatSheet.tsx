import { useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { IconSparkle } from '@/components/common/Icons';
import { Button, Callout, Section, Segmented, TextPane } from '@/components/common/ui';
import { cvcuToBangsal } from '@/domain/reformat/cvcuToBangsal';
import { AiError, aiEnabled, askClaude } from '@/lib/ai';
import { diffSegments } from '@/domain/merge/threeWayMerge';

/**
 * Reformat a CVCU note into the bangsal layout.
 *
 * Shown as a draft, applied only when the user presses the button.
 *
 * The transform is now narrow: it removes the organ-system headers and changes
 * nothing else. An earlier version also re-ordered the section — vitals up,
 * investigations down — which is what the bangsal notes look like, and which
 * broke real notes, because re-ordering means deciding what each line is and
 * every wrong decision moves a finding somewhere it does not belong.
 *
 * The applied text lands in the editor, not in the database, so it still passes
 * through the normal autosave and revision trail. If it is wrong, the previous
 * version is one entry back in "Riwayat perubahan".
 */
export function ReformatSheet({
  open,
  onOpenChange,
  body,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  body: string;
  onApply: (next: string) => void;
}): JSX.Element {
  const deterministic = useMemo(() => cvcuToBangsal(body), [body]);

  /**
   * The AI second pass — a FALLBACK, offered only after the real transform ran.
   *
   * `cvcuToBangsal` stays the default and stays first. It moves blocks whole,
   * never looks inside one, and produces the same output every time, which is
   * what makes it safe to apply to a note without reading every line. The
   * model has none of those properties.
   *
   * It earns a place only where the deterministic pass leaves something wrong:
   * a CVCU note with headings it has never seen, or a layout nobody has taught
   * it. Offering it BEFORE that would replace a transform that is right by
   * construction with one that is usually right, which is a bad trade on a
   * medical record.
   *
   * It is given the deterministic result, not the original: fixing what is
   * left is a smaller and more checkable job than redoing the whole
   * conversion.
   */
  const [aiBody, setAiBody] = useState<string | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'running'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);

  const result = aiBody !== null ? { ...deterministic, body: aiBody } : deterministic;

  const runAi = async (): Promise<void> => {
    setAiState('running');
    setAiError(null);
    try {
      const text = await askClaude(deterministic.body, {
        system: [
          'Catatan ini sudah diubah otomatis dari format CVCU ke format bangsal,',
          'tapi mungkin masih ada sisa header CVCU atau blok yang salah tempat.',
          'Perbaiki SUSUNANNYA saja.',
          '',
          // The shape is stated explicitly because the first attempt at this
          // returned a different document entirely — markdown headings,
          // regrouped sections, "CATATAN PERKEMBANGAN TERINTEGRASI" at the
          // top. Asking for a tidy-up without saying what the target looks
          // like invites a rewrite.
          'BENTUK AKHIR yang benar (jangan ganti jadi bentuk lain):',
          '- Tetap catatan WhatsApp biasa. JANGAN pakai markdown (#, ##, **).',
          '- Penanda tetap *tebal* dan _miring_ seperti aslinya, bullet "- ".',
          '- Urutan: pembuka, identitas, DPJP, S, O, penunjang, assessment,',
          '  terapi, Selesai, Plan, blok TS, penutup.',
          '- Urutan pemeriksaan penunjang: EKG, Laboratorium, Urinalisa, ADT,',
          '  Foto Thorax, CT, USG, Echo, LUS, Laporan Tindakan.',
          '- Dalam satu modalitas, tanggal terbaru di atas.',
          '',
          'ATURAN KERAS:',
          '- JANGAN mengubah kata, angka, dosis, satuan, atau tanggal apa pun.',
          '- JANGAN menambah atau menghapus isi. Semua temuan harus tetap ada.',
          '- JANGAN mengganti judul jadi bahasa Inggris atau format lain.',
          '- Yang boleh: menghapus sisa header A-H (Airway/Breathing/dst),',
          '  memindahkan blok utuh ke tempat yang tepat, merapikan baris kosong.',
          '- JANGAN memindahkan baris satu per satu; pindahkan blok beserta judulnya.',
          '- Keluarkan HANYA catatannya, tanpa pengantar.',
        ].join('\n'),
        maxTokens: 3000,
      });
      setAiBody(text);
    } catch (error) {
      setAiError(error instanceof AiError ? error.message : 'Gagal memanggil AI.');
    } finally {
      setAiState('idle');
    }
  };
  /**
   * Two views, the same pair the day comparison offers.
   *
   * A single pane of output tells you what the result says but not what moved,
   * and "what moved" is the only question worth asking of a transform you are
   * about to apply to a clinical note.
   */
  const [view, setView] = useState<'berdampingan' | 'perubahan'>('berdampingan');
  const segments = useMemo(
    () => (view === 'perubahan' ? diffSegments(body, result.body) : null),
    [view, body, result.body],
  );
  const changed = result.body !== body;
  const delta = aiBody !== null ? aiBody.length - deterministic.body.length : 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Ubah ke format bangsal"
      description="Menghapus header Airway/Breathing/Circulation dst. Urutan isi tidak berubah."
      footer={
        <Button
          variant="primary"
          full
          disabled={!changed}
          onClick={() => {
            onApply(result.body);
            onOpenChange(false);
          }}
        >
          {aiBody !== null ? 'Terapkan hasil AI ke catatan' : 'Terapkan ke catatan'}
        </Button>
      }
    >
      {!changed ? (
        <Callout title="Sudah dalam format bangsal">
          Tidak ada header Airway/Breathing/Circulation di bagian O, jadi tidak ada yang perlu
          diubah.
        </Callout>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={result.summary.vitals} label="tanda vital diangkat ke atas" />
            <Stat value={result.summary.exam} label="baris pemeriksaan fisis" />
            <Stat value={result.summary.investigations} label="blok penunjang dipindah ke bawah" />
          </div>

          {result.summary.unmatched > 0 ? (
            <Callout tone="warn" role="alert" title={`${result.summary.unmatched} bagian tidak dikenali`}>
              Dikumpulkan di “Lain-lain” supaya tidak ada yang hilang. Periksa letaknya di kolom
              Sesudah sebelum menerapkan.
            </Callout>
          ) : null}

          {/*
            Offered after the transform, not instead of it — and only with a key
            and the switch on.
          */}
          {aiEnabled('soap') ? (
            aiBody === null ? (
              <Callout
                tone="info"
                title="Hasilnya masih belum rapi?"
                action={
                  <Button
                    size="sm"
                    icon={<IconSparkle width={14} height={14} />}
                    onClick={() => void runAi()}
                    disabled={aiState === 'running'}
                  >
                    {aiState === 'running' ? 'Memperbaiki…' : 'Perbaiki dengan AI'}
                  </Button>
                }
              >
                AI hanya merapikan susunan dari hasil otomatis ini; kata, angka, dan dosis tidak
                boleh berubah.
                {aiError ? <span className="mt-1 block text-danger">{aiError}</span> : null}
              </Callout>
            ) : (
              <Callout
                tone="accent"
                title="Memakai hasil AI"
                action={
                  <Button size="sm" onClick={() => setAiBody(null)}>
                    Kembali ke hasil otomatis
                  </Button>
                }
              >
                {/* Length delta, computed without a model: a big change is the
                    signal that content was dropped or invented. */}
                {delta === 0
                  ? 'Panjang teks sama dengan hasil otomatis.'
                  : `${delta > 0 ? '+' : ''}${delta} karakter dibanding hasil otomatis. Periksa tidak ada isi yang hilang.`}
              </Callout>
            )
          ) : null}

          <Section
            title="Preview"
            aside={
              <Segmented
                size="sm"
                label="Tampilan"
                value={view}
                onChange={setView}
                options={[
                  ['berdampingan', 'Berdampingan'],
                  ['perubahan', 'Tandai perubahan'],
                ]}
              />
            }
            hint="Bila hasilnya tidak sesuai setelah diterapkan, versi sebelumnya ada di Riwayat perubahan."
          >
            {segments ? (
              <TextPane maxHeight="max-h-[55vh]">
                {segments.map((segment, index) => (
                  <span
                    key={index}
                    className={
                      segment.type === 'insert'
                        ? 'bg-[var(--card-step-12-bg)] text-[var(--card-step-12-fg)]'
                        : segment.type === 'delete'
                          ? 'bg-[var(--card-step-1-bg)] text-[var(--card-step-1-fg)] line-through'
                          : undefined
                    }
                  >
                    {segment.text}
                  </span>
                ))}
              </TextPane>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextPane label="Sebelum" maxHeight="max-h-[55vh]">
                  {body}
                </TextPane>
                <TextPane label="Sesudah" maxHeight="max-h-[55vh]">
                  {result.body}
                </TextPane>
              </div>
            )}
          </Section>
        </div>
      )}
    </Sheet>
  );
}

function Stat({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle px-3 py-2.5">
      <p className="text-2xl font-semibold tabular-nums text-fg">{value}</p>
      <p className="text-[11px] leading-snug text-fg-muted">{label}</p>
    </div>
  );
}
