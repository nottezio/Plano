import type { SessionEvent } from '@/lib/sessionLog';

/**
 * Bug reports and feature suggestions, sent from Pengaturan to `feedback/{id}`
 * and read only on /admin.
 *
 * A bug report carries what the owner would otherwise have to ask for: the
 * app version, the device, and the session log, which since this feature also
 * records uncaught errors with their route and stack frames (`describeError`).
 * The log is identity-free by design (see `sessionLog.ts`). The description is
 * free text, so the form asks for no patient names or MRNs.
 */

export type FeedbackKind = 'bug' | 'fitur';
export type FeedbackStatus = 'baru' | 'selesai';

/** Mirrored in `firestore.rules` (`match /feedback`), checked by a test. */
export const MAX_FEEDBACK_CHARS = 4000;

export interface FeedbackDevice {
  appVersion: string;
  userAgent: string;
  viewport: string;
  online: boolean;
  /** Opened as the installed app rather than a browser tab. */
  standalone: boolean;
}

export interface Feedback {
  id: string;
  uid: string;
  email: string;
  kind: FeedbackKind;
  text: string;
  status: FeedbackStatus;
  createdAt: Date | null;
  device: FeedbackDevice;
  log: SessionEvent[];
}

/**
 * The report as one Markdown block, to paste into Claude Code: everything it
 * needs to start on the bug without asking.
 */
export function feedbackForClaude(report: Feedback): string {
  const { device } = report;
  const errors = report.log.filter((entry) => entry.kind === 'error');
  const lines = [
    `## Plano ${report.kind === 'bug' ? 'bug report' : 'feature request'}`,
    '',
    `- Sent: ${report.createdAt?.toISOString() ?? 'not yet synced'}`,
    `- App version: ${device.appVersion}`,
    `- Device: ${device.userAgent}`,
    `- Viewport: ${device.viewport}, ${device.standalone ? 'installed app' : 'browser tab'}, ${device.online ? 'online' : 'offline'}`,
    '',
    '### Description (user)',
    '',
    report.text,
  ];
  if (report.kind === 'bug') {
    lines.push('', `### Errors recorded on the device (${errors.length})`, '');
    lines.push(...(errors.length ? errors.map((entry) => `- ${entry.at} ${entry.detail ?? ''}`) : ['- none']));
    lines.push('', '### Session log (oldest first)', '');
    lines.push(
      ...report.log.map(
        (entry) =>
          `- ${entry.at} ${entry.kind}${entry.online ? '' : ' (offline)'}${entry.detail ? ` — ${entry.detail}` : ''}`,
      ),
    );
    lines.push(
      '',
      'Frames name built chunks (no source maps in production): find the source by the route and chunk name.',
    );
  }
  return lines.join('\n');
}
