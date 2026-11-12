import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { inlineRuns } from '@/domain/format/soapDocx';
import type { DeckPhoto, DeckSlide } from '@/domain/slides/deck';
import { nudge, rectAfterDrag, rectAfterResize } from '@/domain/slides/editMath';
import { GEOMETRY, PALETTE_B, SLIDE_H, SLIDE_W, type Rect } from '@/domain/slides/geometry';
import { photoRect } from '@/domain/slides/pptx';

/**
 * The slide as the export will draw it, from the same geometry, in percent of
 * the frame. Text sizes are in container-width units so a thumbnail and the
 * full preview scale alike (the slide is 960 pt wide).
 *
 * Colours are the slide's own (Palette B), not the app theme: this is a
 * picture of the file, and it should look the same in Senja or dark mode.
 */

const box = (r: Rect): CSSProperties => ({
  position: 'absolute',
  left: `${(r.x / SLIDE_W) * 100}%`,
  top: `${(r.y / SLIDE_H) * 100}%`,
  width: `${(r.w / SLIDE_W) * 100}%`,
  height: `${(r.h / SLIDE_H) * 100}%`,
});
const pt = (size: number): string => `${(size / 9.6).toFixed(3)}cqw`;
const hex = (value: string): string => `#${value}`;

function BoxedTitle({ rect, lines, size, bold = false }: { rect: Rect; lines: readonly string[]; size: number; bold?: boolean }): JSX.Element {
  return (
    <div
      style={{
        ...box(rect),
        zIndex: 2,
        background: hex(PALETTE_B.boxFill),
        border: `max(1px, 0.22cqw) solid ${hex(PALETTE_B.boxLine)}`,
        color: hex(PALETTE_B.ink),
        fontSize: pt(size),
        fontWeight: bold ? 700 : 400,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
      className="flex flex-col items-center justify-center overflow-hidden text-center leading-tight"
    >
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
      <span
        aria-hidden="true"
        style={{ position: 'absolute', bottom: '-0.15cqw', left: '39%', width: '22%', height: '0.3cqw', background: hex(PALETTE_B.accent) }}
      />
    </div>
  );
}

/** Note text as on the slide: section-only lines bold in the section colour, everything else as typed. */
function NoteText({ text, size }: { text: string; size: number }): JSX.Element {
  return (
    <div style={{ fontSize: pt(size), color: hex(PALETTE_B.ink) }} className="whitespace-pre-wrap leading-[1.2]">
      {text.split('\n').map((line, i) => {
        const label = /^(plan|planning)$/i.test(line.trim()) || /^[^:]{1,40}:$/.test(line.trim());
        return (
          <div key={i} style={label ? { color: hex(PALETTE_B.sec), fontWeight: 700 } : undefined}>
            {label || !line
              ? line || ' '
              : inlineRuns(line).map((run, k) => (
                  <span
                    key={k}
                    style={{
                      fontWeight: run.bold ? 700 : undefined,
                      fontStyle: run.italic ? 'italic' : undefined,
                      textDecoration: run.strike ? 'line-through' : undefined,
                    }}
                  >
                    {run.text}
                  </span>
                ))}
          </div>
        );
      })}
    </div>
  );
}

interface PhotoProps {
  photo: DeckPhoto;
  frame: Rect;
  url: string | undefined;
  editable: boolean;
  label: string;
  onMove?: (rect: Rect) => void;
}

/** A photo; when editable it drags, resizes from its corner, and nudges with the arrow keys. */
function Photo({ photo, frame, url, editable, label, onMove }: PhotoProps): JSX.Element {
  const placed = photoRect(photo, frame);
  const [live, setLive] = useState<Rect | null>(null);
  const start = useRef<{ x: number; y: number; rect: Rect; mode: 'move' | 'resize'; scale: number } | null>(null);
  const rect = live ?? placed;

  const begin = (event: PointerEvent<HTMLElement>, mode: 'move' | 'resize'): void => {
    if (!editable) return;
    const slide = event.currentTarget.closest('[data-slide]');
    if (!slide) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, y: event.clientY, rect, mode, scale: SLIDE_W / slide.getBoundingClientRect().width };
  };
  const move = (event: PointerEvent<HTMLElement>): void => {
    const s = start.current;
    if (!s) return;
    const dx = (event.clientX - s.x) * s.scale;
    const dy = (event.clientY - s.y) * s.scale;
    setLive(s.mode === 'move' ? rectAfterDrag(s.rect, dx, dy) : rectAfterResize(s.rect, dx));
  };
  const end = (): void => {
    if (start.current && live) onMove?.(live);
    start.current = null;
    setLive(null);
  };
  const key = (event: KeyboardEvent<HTMLElement>): void => {
    const next = nudge(rect, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    onMove?.(next);
  };

  return (
    <div
      style={{ ...box(rect), zIndex: 1, boxShadow: '0 0.3cqw 0.8cqw rgba(0,0,0,0.18)', outlineColor: hex(PALETTE_B.accent) }}
      className={editable ? 'cursor-move touch-none outline-dashed outline-2 outline-offset-2 focus-visible:outline-solid' : ''}
      {...(editable
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `${label}. Seret untuk memindah, tombol panah untuk menggeser.`,
            onPointerDown: (e: PointerEvent<HTMLElement>) => begin(e, 'move'),
            onPointerMove: move,
            onPointerUp: end,
            onPointerCancel: end,
            onKeyDown: key,
          }
        : {})}
    >
      {url ? (
        <img src={url} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-fill" />
      ) : (
        <div className="h-full w-full" style={{ background: hex(PALETTE_B.boxLine) }} />
      )}
      {editable ? (
        <span
          aria-hidden="true"
          onPointerDown={(e) => begin(e, 'resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{ background: hex(PALETTE_B.accent) }}
          className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-white shadow"
        />
      ) : null}
    </div>
  );
}

function Table({ rect, columns, rows, children }: { rect: Rect; columns: readonly number[]; rows: string; children: ReactNode }): JSX.Element {
  const total = columns.reduce((a, b) => a + b, 0);
  return (
    <div
      style={{
        ...box(rect),
        display: 'grid',
        gridTemplateColumns: columns.map((w) => `${(w / total) * 100}%`).join(' '),
        gridTemplateRows: rows,
      }}
    >
      {children}
    </div>
  );
}

const cellStyle = (fill: string): CSSProperties => ({
  background: hex(fill),
  border: `1px solid ${hex(PALETTE_B.grid)}`,
  padding: '0.5cqw 0.75cqw',
  overflow: 'hidden',
});

export function SlidePreview({
  slide,
  urls,
  editable = false,
  onMovePhoto,
  className = '',
}: {
  slide: DeckSlide;
  urls: ReadonlyMap<string, string>;
  editable?: boolean;
  onMovePhoto?: (imageId: string, rect: Rect) => void;
  className?: string;
}): JSX.Element {
  let content: ReactNode;
  let background = hex(PALETTE_B.bg);

  switch (slide.kind) {
    case 'title':
      background = `linear-gradient(135deg, ${hex(PALETTE_B.titleBgFrom)}, ${hex(PALETTE_B.titleBgTo)})`;
      content = (
        <>
          <BoxedTitle rect={GEOMETRY.titleBox} lines={slide.heading} size={32} bold />
          <div style={{ ...box(GEOMETRY.titleSub), fontSize: pt(18), color: hex(PALETTE_B.subInk) }} className="pt-[1cqw] text-center">
            {slide.subtitle}
          </div>
        </>
      );
      break;
    case 'soap': {
      const head = (text: string): JSX.Element => (
        <div
          style={{ ...cellStyle(PALETTE_B.head), color: '#fff', fontSize: pt(18), padding: '0 0.75cqw' }}
          className="flex items-center justify-center whitespace-nowrap"
        >
          {text}
        </div>
      );
      content = (
        <Table rect={GEOMETRY.soapTable} columns={GEOMETRY.soapCols} rows={`${(GEOMETRY.soapHeaderH / SLIDE_H) * 100}% 1fr`}>
          <div className="contents">
            {head('Identitas')}
            {head('Anamnesis dan Pemeriksaan Fisik')}
            {head('Diagnosis dan Terapi')}
          </div>
          <div style={cellStyle(PALETTE_B.idCol)}>
            <NoteText text={slide.identitas} size={slide.fontPt} />
          </div>
          <div style={cellStyle(PALETTE_B.body)}>
            <NoteText text={slide.col2} size={slide.fontPt} />
          </div>
          <div style={cellStyle(PALETTE_B.body2)}>
            <NoteText text={slide.col3} size={slide.fontPt} />
          </div>
        </Table>
      );
      break;
    }
    case 'images': {
      const frames = GEOMETRY.photos[slide.layout];
      content = (
        <>
          {slide.photos.map((photo, index) => (
            <Photo
              key={photo.imageId}
              photo={photo}
              frame={frames[Math.min(index, frames.length - 1)]!}
              url={urls.get(photo.imageId)}
              editable={editable}
              label={`Foto ${index + 1}`}
              onMove={(rect) => onMovePhoto?.(photo.imageId, rect)}
            />
          ))}
          {slide.layout === 'photoText' ? (
            <div style={{ ...box(GEOMETRY.photoTextBox), ...cellStyle(PALETTE_B.body) }}>
              <NoteText text={slide.text ?? ''} size={12} />
            </div>
          ) : null}
          <BoxedTitle rect={GEOMETRY.pageTitle} lines={[slide.title]} size={24} />
        </>
      );
      break;
    }
    case 'text':
      content = (
        <>
          <div style={{ ...box(GEOMETRY.textOnly), ...cellStyle(PALETTE_B.body) }}>
            <NoteText text={slide.body} size={14} />
          </div>
          <BoxedTitle rect={GEOMETRY.pageTitle} lines={[slide.title]} size={24} />
        </>
      );
      break;
    case 'lab': {
      const rect = GEOMETRY.labTable;
      const first = Math.round(rect.w * GEOMETRY.labFirstColShare);
      const n = Math.max(1, slide.dates.length);
      const columns = [first, ...Array.from({ length: n }, () => (rect.w - first) / n)];
      const cell = (text: string, fill: string, center: boolean, header = false): JSX.Element => (
        <div
          style={{ ...cellStyle(fill), fontSize: pt(14), color: header ? '#fff' : hex(PALETTE_B.ink) }}
          className={`flex items-center ${center ? 'justify-center text-center' : ''}`}
        >
          {text}
        </div>
      );
      content = (
        <>
          <Table rect={rect} columns={columns} rows={`17.6% repeat(${Math.max(1, slide.rows.length)}, 1fr)`}>
            {cell('Pemeriksaan', PALETTE_B.head, true, true)}
            {slide.dates.map((date) => (
              <div key={date} className="contents">
                {cell(date, PALETTE_B.head, true, true)}
              </div>
            ))}
            {slide.rows.map((row, r) => (
              <div key={row.label} className="contents">
                {cell(row.label, r % 2 ? PALETTE_B.body2 : PALETTE_B.body, false)}
                {row.cells.map((value, c) => (
                  <div key={c} className="contents">
                    {cell(value, r % 2 ? PALETTE_B.body2 : PALETTE_B.body, true)}
                  </div>
                ))}
              </div>
            ))}
          </Table>
          <BoxedTitle rect={GEOMETRY.pageTitle} lines={[slide.title]} size={24} />
        </>
      );
      break;
    }
    case 'closing':
      content = <BoxedTitle rect={GEOMETRY.closingBox} lines={['Terima kasih']} size={32} />;
      break;
  }

  return (
    <div
      data-slide=""
      style={{ background, fontFamily: "'Gill Sans MT','Gill Sans',Calibri,sans-serif" }}
      className={`relative aspect-video w-full select-none overflow-hidden rounded-md shadow-card ring-1 ring-black/10 [container-type:size] ${className}`}
    >
      {content}
    </div>
  );
}
