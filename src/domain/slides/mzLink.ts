/** Registry id of Prof. Muzakkir Amir (`dpjp.ts`). */
export const MZ_ID = 'mz';

/**
 * Whether a patient gets Slide MZ: MZ on ANY DPJP line (owner, 2026-11-12),
 * whether as the main consultant, a co-managing one, or only detected in
 * today's note.
 */
export function hasMz(
  patient: { dpjpId?: string | undefined; dpjpIds?: readonly string[] | undefined },
  detectedIds: readonly string[],
): boolean {
  return patient.dpjpId === MZ_ID || Boolean(patient.dpjpIds?.includes(MZ_ID)) || detectedIds.includes(MZ_ID);
}

/** `9 gambar · 6,2 MB` (MiB, decimal comma as written in Indonesian). */
export function formatSlideUsage(usage: { images: number; bytes: number }): string {
  if (usage.images === 0) return 'tanpa gambar';
  const mb = (usage.bytes / (1024 * 1024)).toFixed(1).replace('.', ',');
  return `${usage.images} gambar · ${mb} MB`;
}
