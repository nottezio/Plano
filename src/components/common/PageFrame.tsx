import type { ReactNode } from 'react';

/**
 * One frame for the list-and-settings pages (Arsip, Dokumen, Pengaturan; 26 Oct
 * 2026, Avi: "the spacing is weird"). They had each picked their own width
 * (768 / 1024 / 768 px), their own header padding and their own heading
 * spacing, so moving between them shifted the content sideways and the rhythm
 * changed on every tab.
 *
 * Now: one measure (`max-w-4xl`) centred in the working area, one gutter
 * (16 px on a phone, 24 px from `sm`), a sticky header whose rows are 12 px
 * apart, and one section label. The scale is 4 / 8 / 12 / 16 / 24 / 32.
 */
export const PAGE_X = 'mx-auto w-full max-w-4xl px-4 sm:px-6';

/** A row of chips: scrolls sideways on a phone (the bleed reaches the screen edge), wraps on a wide screen. */
export const CHIP_ROW =
  '-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0';

/** The pinned top of a page: search, filters. Rows 12 px apart, a hairline under the whole block. */
export function PageHeader({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-bg">
      <div className={`${PAGE_X} space-y-3 py-3`}>{children}</div>
    </div>
  );
}

/** The scrolling content under a `PageHeader`; clears the floating add button on a phone. */
export function PageBody({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={`${PAGE_X} pb-24 pt-5 sm:pb-10 ${className}`}>{children}</div>;
}

/**
 * A titled run inside a page: the label, its count, a hairline to the edge.
 * More space above than below, so the heading belongs to what follows it.
 */
export function SectionLabel({ title, count }: { title: string; count?: number }): JSX.Element {
  return (
    <h2 className="flex items-center gap-3 pb-3 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</span>
      {count !== undefined ? <span className="text-xs tabular-nums text-fg-faint">{count}</span> : null}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </h2>
  );
}
