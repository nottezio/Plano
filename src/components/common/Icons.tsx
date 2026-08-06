import type { SVGProps } from 'react';

/**
 * Hand-rolled icons. Deliberately not an icon package: the shell needs six
 * glyphs, and a dependency here would be ~40 kB of tree-shake roulette on a
 * ward wifi connection.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="22"
      height="22"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconBoard = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Base>
);

export const IconArchive = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </Base>
);

export const IconDocuments = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6M9 16h6" />
  </Base>
);

export const IconSettings = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
  </Base>
);

export const IconSearch = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

export const IconRefresh = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M20 11a8 8 0 1 0-2.3 6.3" />
    <path d="M20 5v6h-6" />
  </Base>
);

export const IconShare = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M12 16V4" />
    <path d="m8 8 4-4 4 4" />
    <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </Base>
);

export const IconClose = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
