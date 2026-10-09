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

/** Helper: a clipboard, so it no longer borrows Checklist's glyph. */
export const IconClipboard = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" />
    <path d="M9 11h6M9 15h4" />
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

export const IconNote = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10l-5 5H5a1 1 0 0 1-1-1z" />
    <path d="M20 15h-4a1 1 0 0 0-1 1v4" />
    <path d="M8 9h8M8 13h5" />
  </Base>
);

export const IconCalculator = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8 7h8" />
    <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h8" />
  </Base>
);

export const IconChecklist = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M4 6l2 2 3-3" />
    <path d="M4 13l2 2 3-3" />
    <path d="M4 20l2 2 3-3" />
    <path d="M13 7h7M13 14h7M13 21h7" />
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

/**
 * The tools disclosure in the phone tab bar.
 *
 * Three dots rather than a chevron: a chevron implies the row expands in
 * place, and this opens a sheet.
 */
export const IconMore = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Base>
);

/** The trash, for the archive's bin. Lid and body, no fill. */
export const IconTrash = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
  </Base>
);

/** Preview. An eye, for reading without opening. */
export const IconEye = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.5" />
  </Base>
);

/**
 * Discharge. A car, for the patient who is going home.
 *
 * An SVG rather than the 🚗 emoji: the emoji renders as a different picture on
 * every OS (and as a monochrome outline on some ward machines), it cannot take
 * the discharge-stage colour because emoji fonts ignore `currentColor`, and its
 * metrics vary enough that it shifts the chip's baseline. This one is one shape
 * everywhere and tints with whatever colour the chip sets.
 */
export const IconCar = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M4 12l1.7-4.4a2 2 0 0 1 1.9-1.3h8.8a2 2 0 0 1 1.9 1.3L20 12" />
    <path d="M3 12h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
    <circle cx="7.5" cy="17" r="1.5" />
    <circle cx="16.5" cy="17" r="1.5" />
  </Base>
);

/** Back, for leaving a full-screen editor on a phone. */
export const IconBack = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="m15 18-6-6 6-6" />
  </Base>
);

export const IconPlus = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

/** A pushpin: pinned notes sit above the rest of their shelf. */
export const IconPin = (props: IconProps & { filled?: boolean }): JSX.Element => {
  const { filled, ...rest } = props;
  return (
    <Base {...rest}>
      <path
        d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z"
        fill={filled ? 'currentColor' : 'none'}
      />
      <path d="M12 15v5" />
    </Base>
  );
};

/** Six dots: the handle a row is dragged by. */
export const IconGrip = (props: IconProps): JSX.Element => (
  <Base {...props}>
    {[6, 12, 18].map((y) => (
      <g key={y}>
        <circle cx="9" cy={y} r="1.3" fill="currentColor" stroke="none" />
        <circle cx="15" cy={y} r="1.3" fill="currentColor" stroke="none" />
      </g>
    ))}
  </Base>
);

/** Two overlapping sheets: "tap to copy". */
export const IconCopy = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </Base>
);

/* Sheet and menu glyphs (2026-10-04 sheet revamp). Same 24-grid, same stroke. */

export const IconChevronRight = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);

export const IconCheck = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);

/** Flask: lab results. */
export const IconFlask = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M9 3h6M10 3v6l-5.2 8.7A2.2 2.2 0 0 0 6.7 21h10.6a2.2 2.2 0 0 0 1.9-3.3L14 9V3" />
    <path d="M7.5 15h9" />
  </Base>
);

/** Speech bubble: opening / closing sentences. */
export const IconQuote = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </Base>
);

/** Two columns: compare. */
export const IconColumns = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <rect x="3.5" y="4" width="7" height="16" rx="1.5" />
    <rect x="13.5" y="4" width="7" height="16" rx="1.5" />
  </Base>
);

/** Stacked sheets: a version of the note. */
export const IconLayers = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="m12 4 8 4-8 4-8-4z" />
    <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
  </Base>
);

/** Printer: a note exported for printing. */
export const IconPrinter = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M7 9V4h10v5" />
    <rect x="4" y="9" width="16" height="7" rx="1.5" />
    <path d="M7 14h10v6H7z" />
  </Base>
);

/** Calendar: pick another day. Replaces the 📅 emoji, which rendered as a
 *  coloured clip-art page on Android and ignored dark mode. */
export const IconCalendar = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Base>
);

/** Moon: a jaga note. */
export const IconMoon = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />
  </Base>
);

/** Sparkle: an AI action. */
export const IconSparkle = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9z" />
    <path d="M19 3v3M17.5 4.5h3" />
  </Base>
);

/** Arrows exchanging: convert a format. */
export const IconConvert = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </Base>
);

/** Person with a clock-hand: a patient held temporarily (titipan). */
export const IconHandoff = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <circle cx="18" cy="15" r="3.5" />
    <path d="M18 13.5V15l1 1" />
  </Base>
);

/** Arrow up into a tray: read a file. */
export const IconUpload = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </Base>
);

/** Rotate back: reopen. */
export const IconReopen = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7" />
    <path d="M4 4v4.7h4.7" />
  </Base>
);

/** Simpan (saved Helper results). */
export const IconBookmark = (props: IconProps): JSX.Element => (
  <Base {...props}>
    <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />
  </Base>
);
