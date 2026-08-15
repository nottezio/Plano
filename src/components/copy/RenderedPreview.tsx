import { useMemo } from 'react';

/**
 * What the message will look like once WhatsApp has rendered it.
 *
 * Deliberately NOT the thing you copy from. Selecting rendered text copies the
 * words without the markers that produced the formatting, so a paste from here
 * would arrive unbolded — the preview would have quietly undone the thing it
 * was showing you. The copyable text lives in the other tab, as characters.
 *
 * This renders the same four markers WhatsApp does and nothing else. Anything
 * cleverer would start diverging from the real renderer, and a preview that is
 * confidently wrong is worse than no preview.
 */

interface Token {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  mono?: boolean;
}

/** WhatsApp's own set: `*bold*`, `_italic_`, `~strike~`, ```mono```. */
const PATTERN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`\n]+```)/g;

function tokenise(line: string): Token[] {
  const tokens: Token[] = [];

  for (const part of line.split(PATTERN)) {
    if (!part) continue;

    if (part.startsWith('```') && part.endsWith('```') && part.length > 6) {
      tokens.push({ text: part.slice(3, -3), mono: true });
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      tokens.push({ text: part.slice(1, -1), bold: true });
    } else if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      tokens.push({ text: part.slice(1, -1), italic: true });
    } else if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      tokens.push({ text: part.slice(1, -1), strike: true });
    } else {
      tokens.push({ text: part });
    }
  }

  return tokens;
}

export function RenderedPreview({ text }: { text: string }): JSX.Element {
  const lines = useMemo(() => text.split('\n').map(tokenise), [text]);

  return (
    <div className="max-h-56 overflow-auto rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
      {lines.map((tokens, lineIndex) => (
        <p key={lineIndex} className="min-h-[1.2em] whitespace-pre-wrap break-words">
          {tokens.map((token, index) => (
            <span
              key={index}
              className={[
                token.bold ? 'font-semibold' : '',
                token.italic ? 'italic' : '',
                token.strike ? 'line-through' : '',
                token.mono ? 'font-mono' : '',
              ].join(' ')}
            >
              {token.text}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
