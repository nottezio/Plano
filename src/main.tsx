import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';

import App from './App';
import { AuthGate } from '@/components/auth/AuthGate';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { initSyncStatus } from '@/data/syncStatus';
import { initSession } from '@/store/useSession';
import { initThemeSync } from '@/store/useUI';
import { createAppHistory } from '@/lib/appHistory';
import { installChunkRecovery, markBootSucceeded } from '@/lib/chunkRecovery';
import { registerServiceWorker } from './pwa';
import '@/styles/index.css';

const container = document.getElementById('root');
if (!container) {
  // Fail loudly. A silent no-op here would look like a blank screen at a
  // bedside, which is indistinguishable from data loss to the user.
  throw new Error('[visite] #root missing from index.html');
}

// Before anything else: a stale precached shell fails during module load.
installChunkRecovery();

initThemeSync();
initSyncStatus();
initSession();

markBootSucceeded();

// Back goes up to the parent screen, not to the previous page (lib/appHistory).
const appRouterHistory = createAppHistory();

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      {/* basename lets the same bundle serve "/" and "/<repo>/" on Pages. */}
      <HistoryRouter history={appRouterHistory} basename={import.meta.env.BASE_URL}>
        <AuthGate>
          <App />
        </AuthGate>
      </HistoryRouter>
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
