import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { subscribeAllAccess } from '@/data/repositories/access.repo';
import { isAdmin, type AccessRecord } from '@/domain/access';
import { useSession } from '@/store/useSession';
import { AccountsTab } from './admin/AccountsTab';
import { FeedbackTab } from './admin/FeedbackTab';
import { KuotaTab } from './admin/KuotaTab';
import { ListTab } from './admin/ListTab';
import { MessagesTab } from './admin/MessagesTab';
import { PatientsTab } from './admin/PatientsTab';
import NotFoundPage from './NotFoundPage';
import { APP_VERSION } from '@/version.js';

/**
 * /admin — who uses Plano, and who may.
 *
 * Not linked for anyone else, and renders the ordinary "not found" page for
 * them. That is courtesy, not security: the data below comes from documents
 * the rules let only the admin read, so another account opening this route
 * gets nothing even if it bypasses this check.
 *
 * Shows registration details and the counts each app reports about itself.
 * Patients and notes are opened only in the Pasien tab, read only, stamped on
 * the account first: see `src/domain/access.ts`.
 */
export default function AdminPage(): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  if (!isAdmin(uid)) return <NotFoundPage />;
  return <AdminConsole adminUid={uid as string} />;
}

/**
 * The tabs. The selected one lives in the URL (`?tab=laporan`), so a tab can
 * be linked and survives a reload. A tab reads only while it is open; the
 * account list is the exception, held here as ONE listener because several
 * tabs need it.
 */
const TABS = [
  { id: 'akun', label: 'Akun' },
  { id: 'kuota', label: 'Kuota' },
  { id: 'pasien', label: 'Pasien' },
  { id: 'list', label: 'List' },
  { id: 'pesan', label: 'Pesan' },
  { id: 'laporan', label: 'Laporan' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function AdminConsole({ adminUid }: { adminUid: string }): JSX.Element {
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.find((entry) => entry.id === params.get('tab'))?.id ?? 'akun';
  const [records, setRecords] = useState<AccessRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeAllAccess(setRecords, (cause: unknown) => {
        console.error('[admin] access list', cause);
        setError(
          'Tidak dapat membaca data admin. Jika aturan Firestore baru belum ter-deploy, ' +
            'tunggu workflow firestore-deploy selesai.',
        );
      }),
    [],
  );

  const select = (id: TabId): void => {
    setParams(id === 'akun' ? {} : { tab: id }, { replace: true });
  };

  return (
    <AppShell title="Admin">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <header className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
            <p className="text-xs text-fg-muted">
              Siapa yang memakai Plano, dan siapa yang boleh. Isi pasien hanya dibuka di tab Pasien,
              hanya baca, dan setiap pembukaan tercatat di akun yang dibuka.
            </p>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-fg-muted">
            v{APP_VERSION}
          </span>
        </header>

        {error ? (
          <p role="alert" className="rounded-lg border border-danger px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div role="tablist" aria-label="Bagian admin" className="flex flex-wrap gap-1 border-b border-border pb-2">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`admin-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls="admin-panel"
              onClick={() => select(entry.id)}
              className={[
                'min-h-tap rounded-full border px-4 text-sm font-medium [@media(pointer:fine)]:min-h-9',
                tab === entry.id ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${tab}`}>
          {tab === 'akun' ? (
            <AccountsTab records={records} adminUid={adminUid} onError={setError} />
          ) : tab === 'kuota' ? (
            <KuotaTab records={records} />
          ) : tab === 'pasien' ? (
            <PatientsTab records={records} onError={setError} />
          ) : tab === 'list' ? (
            <ListTab onError={setError} />
          ) : tab === 'pesan' ? (
            <MessagesTab records={records} adminUid={adminUid} onError={setError} />
          ) : (
            <FeedbackTab />
          )}
        </div>
      </div>
    </AppShell>
  );
}
