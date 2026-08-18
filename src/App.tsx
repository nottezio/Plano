import { Route, Routes } from 'react-router-dom';
import BoardPage from '@/routes/BoardPage';
import ArchivePage from '@/routes/ArchivePage';
import DocumentsPage from '@/routes/DocumentsPage';
import DocumentPage from '@/routes/DocumentPage';
import NotePage from '@/routes/NotePage';
import CalculatorPage from '@/routes/CalculatorPage';
import ChecklistsPage from '@/routes/ChecklistsPage';
import SettingsPage from '@/routes/SettingsPage';
import PatientPage from '@/routes/PatientPage';
import NotFoundPage from '@/routes/NotFoundPage';

/**
 * Route table (SPEC 4 / 5). Paths are user-visible Bahasa Indonesia; the
 * patient deep link keeps the spec'd shape /p/:patientId/:date? so links
 * survive every later phase.
 */
export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<BoardPage />} />
      <Route path="/arsip" element={<ArchivePage />} />
      <Route path="/dokumen" element={<DocumentsPage />} />
      <Route path="/dokumen/:documentId" element={<DocumentPage />} />
      <Route path="/catatan" element={<NotePage />} />
      <Route path="/kalkulator" element={<CalculatorPage />} />
      <Route path="/checklist" element={<ChecklistsPage />} />
      <Route path="/pengaturan" element={<SettingsPage />} />
      <Route path="/p/:patientId" element={<PatientPage />} />
      <Route path="/p/:patientId/:date" element={<PatientPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
