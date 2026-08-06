import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { IconClose } from './Icons';

/**
 * Bottom sheet on phone, centred dialog from 640 px up.
 *
 * Radix rather than a hand-rolled dialog: focus trapping, scroll locking,
 * `aria-modal` and Escape handling are exactly the things a bespoke
 * implementation gets 90% right, and the missing 10% is what breaks keyboard
 * and screen-reader use (SPEC 20).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}): JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <Dialog.Content
          className={[
            'fixed z-50 flex flex-col bg-surface',
            // phone: bottom sheet clearing the home indicator
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
            // tablet/desktop: centred panel
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[32rem] sm:max-w-[92vw]',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0',
            'border border-border shadow-xl',
          ].join(' ')}
        >
          <div className="flex items-start gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-xs text-fg-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Tutup"
              className="min-h-tap min-w-tap -mr-2 -mt-1 flex items-center justify-center text-fg-faint"
            >
              <IconClose />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

          {footer ? <div className="border-t border-border px-4 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
