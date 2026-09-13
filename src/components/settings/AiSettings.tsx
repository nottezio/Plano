import { useState } from 'react';

import {
  readAiFlags,
  readApiKey,
  writeAiFlags,
  writeApiKey,
  type AiFlags,
} from '@/lib/ai';

/**
 * The AI switches, and the key they run on.
 *
 * Everything here is per device and nothing is on by default. Two separate
 * conditions have to be met before a single byte of a note leaves the phone: a
 * key is present, and that feature's switch is on. Two rather than one because
 * they answer different questions — "can this app call the API" and "should it
 * call it with my patient's note".
 */
export function AiSettings(): JSX.Element {
  const [key, setKey] = useState(() => readApiKey());
  const [flags, setFlags] = useState<AiFlags>(() => readAiFlags());
  const [reveal, setReveal] = useState(false);

  const update = (next: Partial<AiFlags>): void => {
    const merged = { ...flags, ...next };
    setFlags(merged);
    writeAiFlags(merged);
  };

  return (
    <div className="space-y-3 text-xs">
      <p className="text-fg-muted">
        Fitur AI memakai API key Anda sendiri, bukan kuota bersama. Key disimpan hanya di
        perangkat ini — tidak disinkronkan, tidak ikut dalam ekspor.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          type={reveal ? 'text' : 'password'}
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
            writeApiKey(event.target.value);
          }}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => setReveal((current) => !current)}
          className="min-h-tap rounded-lg border border-border px-3 font-medium text-fg-muted"
        >
          {reveal ? 'Sembunyikan' : 'Lihat'}
        </button>
      </div>

      <div className="space-y-2">
        <Toggle
          label="Bantu format hasil lab"
          detail="Teks lab yang berantakan diusulkan jadi satu baris. Hasilnya tetap Anda edit."
          checked={flags.lab}
          disabled={!key}
          onChange={(value) => update({ lab: value })}
        />
        <Toggle
          label="Bantu rapikan SOAP"
          detail="Usulan susunan SOAP, ditampilkan berdampingan. Tidak pernah menimpa catatan."
          checked={flags.soap}
          disabled={!key}
          onChange={(value) => update({ soap: value })}
        />
      </div>

      {/*
        Said once, plainly, where the switch is — not buried in a policy page.
        The text sent is a patient's note, and whether that may leave the
        hospital is a question about the hospital, not about this app.
      */}
      <p className="text-fg-faint">
        Saat aktif, teks yang diproses dikirim ke server Anthropic. Pastikan sesuai kebijakan
        rumah sakit dan UU PDP.
      </p>
    </div>
  );
}

function Toggle({
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex min-h-tap items-start gap-2">
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span className={disabled ? 'opacity-50' : undefined}>
        <span className="block font-medium">{label}</span>
        <span className="block text-fg-muted">{detail}</span>
      </span>
    </label>
  );
}
