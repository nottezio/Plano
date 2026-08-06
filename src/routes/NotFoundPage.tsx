import { Link } from 'react-router-dom';
import { AppShell } from '@/components/common/AppShell';

export default function NotFoundPage(): JSX.Element {
  return (
    <AppShell title="Tidak ditemukan">
      <section className="px-4 py-12 text-center">
        <h2 className="text-base font-semibold">Halaman tidak ditemukan</h2>
        <Link to="/" className="mt-3 inline-block text-sm text-accent underline">
          Kembali ke papan
        </Link>
      </section>
    </AppShell>
  );
}
