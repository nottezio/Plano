/**
 * The in-app changelog (Pengaturan → Yang baru).
 *
 * The source is `CHANGELOG.md` at the repository root: short, in Indonesian,
 * written for the person using the app. `CHANGES.md` stays the engineering
 * record (root cause, wrong turns) — 300 kB of English that belongs in git,
 * not in a phone's bundle.
 *
 * Why a markdown file and not an array here: a version string may exist only
 * in `src/version.js` (check:version). The changelog is prose history, like
 * CHANGES.md, and is excluded from that check the same way; this module only
 * parses it. A test fails when the newest entry is not the running version,
 * so a release without an entry cannot pass `verify`.
 *
 * Format:
 *
 *     ## `<version>` — optional title
 *     - one change per bullet
 *       continuation lines are joined to the bullet
 */
export interface ChangelogEntry {
  version: string;
  title: string | null;
  items: string[];
}

const HEADING = /^##\s+`([^`]+)`\s*(?:[—–-]\s*(.+))?$/;

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = HEADING.exec(line);
    if (heading) {
      current = { version: heading[1] ?? '', title: heading[2]?.trim() || null, items: [] };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      current.items.push(bullet[1] ?? '');
      continue;
    }
    const last = current.items.length - 1;
    if (last >= 0 && /^\s+\S/.test(line)) current.items[last] = `${current.items[last] ?? ''} ${line.trim()}`;
  }
  return entries;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** `YYYY-MM-DD.N` → "30 Sep 2026 · rilis 1"; anything else unchanged. */
export function describeVersion(version: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})\.(\d+)$/.exec(version);
  if (!match) return version;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return version;
  return `${String(Number(match[3]))} ${month} ${match[1] ?? ''} · rilis ${match[4] ?? ''}`;
}

/** Inline `**bold**` and `` `code` `` → segments, for rendering without HTML. */
export type InlineSegment = { text: string; kind: 'plain' | 'bold' | 'code' };

export function inlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > index) segments.push({ text: text.slice(index, at), kind: 'plain' });
    if (match[1] !== undefined) segments.push({ text: match[1], kind: 'bold' });
    else segments.push({ text: match[2] ?? '', kind: 'code' });
    index = at + match[0].length;
  }
  if (index < text.length) segments.push({ text: text.slice(index), kind: 'plain' });
  return segments;
}
