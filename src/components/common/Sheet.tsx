import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { IconClose } from './Icons';
import { useBackToClose } from '@/lib/useBackToClose';

/**
 * Bottom sheet on phone, centred dialog from 640 px up.
 *
 * Radix rather than a hand-rolled dialog: focus trapping, scroll locking,
 * `aria-modal` and Escape handling are exactly the things a bespoke
 * implementation gets 90% right, and the missing 10% is what breaks keyboard
 * and screen-reader use (SPEC 20).
 *
 * SIZES (2026-10-04). Every sheet was 32rem wide on a laptop, so a sheet
 * holding a note preview showed it in a column a third of the screen wide
 * and scrolled for everything else. `lg` and `xl` give the preview sheets
 * room for two columns; a phone ignores the size entirely.
 *
 * FOCUS. Radix focuses the first focusable element on open, which is the
 * close button, and Chrome then draws a focus ring around it on every open
 * (the boxed ✕ in Avi's screenshots). Focus goes to the dialog itself
 * instead: still inside the trap, Tab still reaches the close button first,
 * and nothing is highlighted that the user did not move to.
 */
const WIDTH = {
  md: 'sm:w-[34rem]',
  lg: 'sm:w-[46rem]',
  xl: 'sm:w-[64rem]',
  '2xl': 'sm:w-[84rem]',
} as const;

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  fill = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof WIDTH;
  /**
   * From 640 px up: a fixed-height sheet whose body does NOT scroll, so the
   * content lays out its own scrolling columns. For a sheet whose preview is
   * selected by hand: when the whole body scrolled, dragging a selection to
   * the bottom of the preview auto-scrolled the body and the preview moved
   * under the cursor (Salin, 2026-10-05). A phone keeps the scrolling body.
   * Also 92dvh tall rather than 88 (2026-10-05).
   */
  fill?: boolean;
}): JSX.Element {
  useBackToClose(open, () => onOpenChange(false));
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
          }}
          className={[
            'fixed z-50 flex flex-col bg-surface outline-none',
            // phone: bottom sheet clearing the home indicator
            'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
            // tablet/desktop: centred panel
            `sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-[94vw] ${WIDTH[size]}`,
            // A `fill` sheet is taller too: it holds a preview, and the strip of
            // backdrop above and below it was space the preview could have used.
            fill ? 'sm:h-[92dvh] sm:max-h-[92dvh]' : 'sm:max-h-[88dvh]',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0',
            'border border-border shadow-2xl',
          ].join(' ')}
        >
          {/* The grab handle says "this slides" on a phone; a dialog has none. */}
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-start gap-3 px-5 pb-3 pt-3 sm:pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-lg font-semibold leading-tight text-fg">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-xs leading-relaxed text-fg-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Tutup"
              className="-mr-2 -mt-1 flex min-h-tap min-w-tap items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <IconClose width={20} height={20} />
            </Dialog.Close>
          </div>

          <div
            className={[
              'min-h-0 flex-1 overflow-y-auto border-t border-border px-5 py-4',
              fill ? 'sm:overflow-hidden' : '',
            ].join(' ')}
          >
            {children}
          </div>

          {footer ? (
            <div className="border-t border-border bg-surface px-5 py-3 sm:rounded-b-2xl">{footer}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
