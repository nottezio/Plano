import { useState } from 'react';

import {
  looksLikeApiKey,
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

      {/*
        NEVER `type="password"`.

        A password manager targets that type regardless of `autocomplete`,
        which every browser vendor documents and none of them honour for this
        purpose — the field looks like a login to the manager, so it offers
        its own saved credential. Because this input is controlled, accepting
        that offer fires `onChange` and this component would silently write
        someone's unrelated saved password into storage as their Anthropic
        key — no typing, no Save button, nothing to notice until a call fails
        with a 401 that makes no sense.

        Masking is done with CSS instead (`-webkit-text-security`), which
        gives the same dotted appearance without the type that password
        managers watch for. The `data-*` attributes are the documented
        opt-outs for the three managers that ignore `autocomplete="off"`
        outright: 1Password, LastPass, Bitwarden.
      */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
            writeApiKey(event.target.value);
          }}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          style={reveal ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
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

      {/*
        The safety net for the exact failure this replaces: if a manager (or
        anything else) already wrote something here before this fix shipped,
        say so rather than staying silent about a key that is not a key.
      */}
      {key.length > 0 && !looksLikeApiKey(key) ? (
        <p className="text-danger">
          Teks ini tidak seperti API key Anthropic (harusnya diawali "sk-ant-"). Jika Anda
          tidak menempelkannya sendiri, kemungkinan terisi otomatis oleh aplikasi pengelola
          kata sandi — periksa dengan "Lihat", lalu hapus jika bukan milik Anda.
        </p>
      ) : null}

      <div className="space-y-2">
        <Toggle
          label="Bantu format hasil lab"
          detail="Teks lab yang berantakan diusulkan jadi satu baris. Hasilnya tetap Anda edit."
          checked={flags.lab}
          disabled={!key}
          onChange={(value) => update({ lab: value })}
        />
        <Toggle
          label="Periksa SOAP dengan AI"
          detail="Tambahan untuk panel 'Periksa lagi'. Aturan biasa tetap jalan."
          checked={flags.check}
          disabled={!key}
          onChange={(value) => update({ check: value })}
        />
        <Toggle
          label="Ringkas perjalanan pasien"
          detail="Rangkum seluruh catatan jadi presentasi untuk DPJP. Tidak masuk ke catatan."
          checked={flags.summary}
          disabled={!key}
          onChange={(value) => update({ summary: value })}
        />
        <Toggle
          label="Bantu rapikan SOAP"
          detail="Usulan susunan SOAP, ditampilkan berdampingan. Tidak pernah menimpa catatan."
          checked={flags.soap}
          disabled={!key}
          onChange={(value) => update({ soap: value })}
        />
        <Toggle
          label="Verifikasi sensus bangsal (WIP)"
          detail="PDF DENAH dan LIST PASIEN dikirim utuh untuk ditranskripsi — nama, RM dan tanggal lahir semua pasien di dalamnya. Pengecekannya dilakukan di perangkat ini."
          checked={flags.census}
          disabled={!key}
          onChange={(value) => update({ census: value })}
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
