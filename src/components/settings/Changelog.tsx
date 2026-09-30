import { useEffect, useState } from 'react';

import {
  describeVersion,
  inlineSegments,
  parseChangelog,
  type ChangelogEntry,
} from '@/domain/changelog';
import { APP_VERSION } from '@/version.js';

const SEEN_KEY = 'plano.changelogSeen';

/** True when this device has not opened "Yang baru" since this version. */
export function changelogUnseen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) !== APP_VERSION;
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    // Private mode or storage blocked: the badge simply stays.
  }
}

/**
 * Pengaturan → Yang baru. Loaded on open, not in the main bundle: it is read
 * once per update and grows every release.
 */
export function Changelog(): JSX.Element {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    import('../../../CHANGELOG.md?raw')
      .then((module) => {
        if (!alive) return;
        setEntries(parseChangelog(module.default));
        markSeen();
      })
      .catch((error: unknown) => {
        console.error('[changelog] could not load', error);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return <p className="text-xs text-fg-muted">Daftar perubahan tidak bisa dimuat (offline?).</p>;
  }
  if (!entries) return <p className="text-xs text-fg-muted">Memuat…</p>;

  const visible = showAll ? entries : entries.slice(0, 4);
  return (
    <div>
      <ol className="space-y-4">
        {visible.map((entry) => {
          const current = entry.version === APP_VERSION;
          return (
            <li key={entry.version} className="border-l-2 pl-3" style={{ borderColor: current ? 'var(--accent)' : 'var(--border)' }}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                <span>{describeVersion(entry.version)}</span>
                {entry.title ? <span className="font-normal text-fg-muted">— {entry.title}</span> : null}
                {current ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Versi ini
                  </span>
                ) : null}
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-fg">
                {entry.items.map((item, index) => (
                  <li key={index}>
                    {inlineSegments(item).map((segment, part) =>
                      segment.kind === 'bold' ? (
                        <strong key={part}>{segment.text}</strong>
                      ) : segment.kind === 'code' ? (
                        <code key={part} className="rounded bg-bg-subtle px-1 text-[12px]">
                          {segment.text}
                        </code>
                      ) : (
                        <span key={part}>{segment.text}</span>
                      ),
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      {entries.length > visible.length ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 min-h-tap w-full rounded-lg border border-border text-sm text-fg-muted"
        >
          Tampilkan {entries.length - visible.length} pembaruan sebelumnya
        </button>
      ) : null}
    </div>
  );
}
