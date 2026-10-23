import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import BoardPage from '@/routes/BoardPage';
import PatientPage from '@/routes/PatientPage';
import NotFoundPage from '@/routes/NotFoundPage';
import { useAiKeySync } from '@/hooks/useAiKeySync';

// The board and the patient page are the ward round; every other screen loads
// on first open so a cold start parses only those. The service worker
// precaches every chunk, so these still open offline.
const ArchivePage = lazy(() => import('@/routes/ArchivePage'));
const DocumentsPage = lazy(() => import('@/routes/DocumentsPage'));
const DocumentPage = lazy(() => import('@/routes/DocumentPage'));
const NotePage = lazy(() => import('@/routes/NotePage'));
const CalculatorPage = lazy(() => import('@/routes/CalculatorPage'));
const ChecklistsPage = lazy(() => import('@/routes/ChecklistsPage'));
const HelperPage = lazy(() => import('@/routes/HelperPage').then((m) => ({ default: m.HelperPage })));
const SettingsPage = lazy(() => import('@/routes/SettingsPage'));
const AdminPage = lazy(() => import('@/routes/AdminPage'));
const ListMakerPage = lazy(() => import('@/routes/ListMakerPage'));

/**
 * Route table (SPEC 4 / 5). Paths are user-visible Bahasa Indonesia; the
 * patient deep link keeps the spec'd shape /p/:patientId/:date? so links
 * survive every later phase.
 */
export default function App(): JSX.Element {
  // The AI key follows the account (12.6).
  useAiKeySync();
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="/arsip" element={<ArchivePage />} />
        <Route path="/dokumen" element={<DocumentsPage />} />
        <Route path="/dokumen/:documentId" element={<DocumentPage />} />
        <Route path="/catatan" element={<NotePage />} />
        <Route path="/kalkulator" element={<CalculatorPage />} />
        <Route path="/checklist" element={<ChecklistsPage />} />
        <Route path="/helper" element={<HelperPage />} />
        <Route path="/list" element={<ListMakerPage />} />
        <Route path="/pengaturan" element={<SettingsPage />} />
        <Route path="/p/:patientId" element={<PatientPage />} />
        <Route path="/p/:patientId/:date" element={<PatientPage />} />
        {/* Unlinked for everyone but the admin; see AdminPage. */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
