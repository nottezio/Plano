/**
 * Optional AI assists, on the USER'S OWN API key.
 *
 * WHY BRING-YOUR-OWN-KEY
 *
 * Plano is shared. A key baked into the build is a key every user spends, and
 * a key in a GitHub Pages bundle is a key anyone can read out of it — a public
 * static site has no server to hide a secret behind. So each user brings their
 * own, or the AI features simply are not there for them.
 *
 * WHERE IT IS KEPT
 *
 * localStorage on that device, and nowhere else. NOT in Firestore, not in the
 * user profile, not in the export: those sync, and a credential that syncs is
 * a credential on every device that has ever signed in. It is deliberately
 * lost when the browser data is cleared — that is the correct behaviour for a
 * secret, and re-pasting it takes ten seconds.
 *
 * WHAT LEAVES THE DEVICE
 *
 * Every AI call sends the text it is given to Anthropic. That text is clinical.
 * The features are therefore off unless a key is present AND the feature is
 * switched on, both per device, and each call site says what it is about to
 * send. This is a hospital-policy question as much as a technical one, which
 * is why nothing here is on by default.
 */

const KEY = 'visite.ai.key';
const FLAGS = 'visite.ai.flags';

export interface AiFlags {
  /** Suggest a structured lab line from pasted text. */
  lab: boolean;
  /** Suggest a tidied SOAP body. Never applied automatically. */
  soap: boolean;
  /**
   * A second pass over the note, looking for what the six deterministic rules
   * cannot express.
   *
   * Additive only. The rules keep running and their findings are listed
   * first — this never replaces them, because a checker whose findings vary
   * between identical runs is one that stops being trusted.
   */
  check: boolean;
  /**
   * Summarise a whole admission for presenting to a consultant.
   *
   * The one AI feature here with no deterministic equivalent: the task is
   * deciding which three weeks of daily notes matter, not transforming text.
   * It also writes nothing back, so its worst outcome is a summary somebody
   * reads and corrects.
   */
  summary: boolean;
}

const OFF: AiFlags = { lab: false, soap: false, check: false, summary: false };

/**
 * Does this look like an Anthropic key, at a glance?
 *
 * Not a validity check — only the API can say that. This exists for one
 * narrow purpose: to warn when the stored value almost certainly is NOT a
 * key at all, which happens when a password manager fills its own saved
 * credential into the field instead. `sk-ant-` is Anthropic's own prefix and
 * has been stable across every key format they have issued.
 */
export function looksLikeApiKey(value: string): boolean {
  return value.startsWith('sk-ant-');
}

export function readApiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeApiKey(value: string): void {
  try {
    if (value.trim()) localStorage.setItem(KEY, value.trim());
    else localStorage.removeItem(KEY);
  } catch (error) {
    console.warn('[ai] key not saved', error);
  }
}

export function readAiFlags(): AiFlags {
  try {
    const raw = localStorage.getItem(FLAGS);
    if (!raw) return OFF;
    const parsed = JSON.parse(raw) as Partial<AiFlags>;
    return {
      lab: parsed.lab === true,
      soap: parsed.soap === true,
      check: parsed.check === true,
      summary: parsed.summary === true,
    };
  } catch {
    return OFF;
  }
}

export function writeAiFlags(flags: AiFlags): void {
  try {
    localStorage.setItem(FLAGS, JSON.stringify(flags));
  } catch (error) {
    console.warn('[ai] flags not saved', error);
  }
}

/** A feature is available only with a key AND its own switch on. */
export function aiEnabled(feature: keyof AiFlags): boolean {
  return readApiKey().length > 0 && readAiFlags()[feature];
}

export class AiError extends Error {}

/**
 * One call to the Anthropic messages API, from the browser.
 *
 * `anthropic-dangerous-direct-browser-access` is required for a browser
 * origin. The name is fair: it means the key is in the page, which is exactly
 * why it has to be the user's own and why it never syncs.
 *
 * Errors are translated rather than surfaced raw. A 401 here means one thing
 * to the person holding it — the key is wrong — and a stack trace does not say
 * that.
 */
export async function askClaude(
  prompt: string,
  options: { system?: string; maxTokens?: number } = {},
): Promise<string> {
  const key = readApiKey();
  if (!key) throw new AiError('Belum ada API key.');

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: options.maxTokens ?? 1500,
        ...(options.system ? { system: options.system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    // Offline is the normal case on a ward, not an exception. Named as itself
    // so nobody goes looking for a broken key.
    throw new AiError('Tidak ada koneksi ke server AI.');
  }

  if (response.status === 401) throw new AiError('API key ditolak. Periksa kembali key-nya.');
  if (response.status === 429) throw new AiError('Kuota API sedang penuh. Coba lagi nanti.');
  if (!response.ok) throw new AiError(`Gagal memanggil AI (${response.status}).`);

  const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim();

  if (!text) throw new AiError('AI tidak mengembalikan teks.');
  return text;
}
