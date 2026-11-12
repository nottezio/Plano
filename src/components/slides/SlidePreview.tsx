import { createContext, useContext, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { inlineRuns } from '@/domain/format/soapDocx';
import type { DeckPhoto, DeckSlide } from '@/domain/slides/deck';
import { nudge, rectAfterBoxResize, rectAfterDrag, rectAfterResize } from '@/domain/slides/editMath';
import { snapMove, snapResize, type Guides } from '@/domain/slides/snap';
import { PALETTE_B, SLIDE_H, SLIDE_W, geometryFor, slideHeight, type Rect } from '@/domain/slides/geometry';
import { isSectionLabel, photoRect } from '@/domain/slides/pptx';

/**
 * The slide as the export will draw it, from the same geometry, in percent of
 * the frame. Text sizes are in container-width units so a thumbnail and the
 * full preview scale alike (the slide is 960 pt wide).
 *
 * Colours are the slide's own (Palette B), not the app theme: this is a
 * picture of the file, and it should look the same in Senja or dark mode.
 */

/** The slide's height in EMU (16:9 or the tall 4:3 deck), for the components below the preview. */
const SlideH = createContext<number>(SLIDE_H);

const boxIn = (r: Rect, slideH: number): CSSProperties => ({
  position: 'absolute',
  left: `${(r.x / SLIDE_W) * 100}%`,
  top: `${(r.y / slideH) * 100}%`,
  width: `${(r.w / SLIDE_W) * 100}%`,
  height: `${(r.h / slideH) * 100}%`,
});
/** Position helper bound to the surrounding slide's height. */
const useBox = (): ((r: Rect) => CSSProperties) => {
  const slideH = useContext(SlideH);
  return (r) => boxIn(r, slideH);
};
const pt = (size: number): string => `${(size / 9.6).toFixed(3)}cqw`;
const hex = (value: string): string => `#${value}`;

function BoxedTitle({ rect, lines, size, bold = false }: { rect: Rect; lines: readonly string[]; size: number; bold?: boolean }): JSX.Element {
  const box = useBox();
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
function NoteText({ text, size, align = 'l' }: { text: string; size: number; align?: 'l' | 'ctr' }): JSX.Element {
  return (
    <div
      style={{ fontSize: pt(size), color: hex(PALETTE_B.ink), textAlign: align === 'ctr' ? 'center' : 'left' }}
      className="whitespace-pre-wrap leading-[1.2]"
    >
      {text.split('\n').map((line, i) => {
        const label = isSectionLabel(line);
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

/** How close, in screen pixels, an edge must be to a line to snap to it. Alt turns snapping off. */
const SNAP_PX = 6;

interface DraggableProps {
  rect: Rect;
  editable: boolean;
  label: string;
  /** `aspect`: a picture, resized with its proportions kept. `free`: a text box, width and height independently. */
  resize: 'aspect' | 'free';
  onMove?: ((rect: Rect) => void) | undefined;
  /** Rectangles (other objects, the title) whose edges and centres this one snaps to. */
  snapTargets?: readonly Rect[];
  onGuides?: (guides: Guides | null) => void;
  style?: CSSProperties;
  children: ReactNode;
}

/** Drag to move, bottom-right handle to resize, arrow keys to nudge. May leave the slide; the title stays on top. */
function Draggable({ rect: placed, editable, label, resize, onMove, snapTargets = [], onGuides, style, children }: DraggableProps): JSX.Element {
  const box = useBox();
  const slideH = useContext(SlideH);
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
    const raw =
      s.mode === 'move' ? rectAfterDrag(s.rect, dx, dy) : resize === 'free' ? rectAfterBoxResize(s.rect, dx, dy) : rectAfterResize(s.rect, dx);
    if (event.altKey) {
      setLive(raw);
      onGuides?.(null);
      return;
    }
    const snapped =
      s.mode === 'move'
        ? snapMove(raw, snapTargets, slideH, SNAP_PX * s.scale)
        : snapResize(raw, snapTargets, slideH, SNAP_PX * s.scale, resize === 'aspect');
    setLive(snapped.rect);
    onGuides?.(snapped.guides);
  };
  const end = (): void => {
    onGuides?.(null);
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
      style={{ ...box(rect), zIndex: 1, outlineColor: hex(PALETTE_B.accent), ...style }}
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
      {children}
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

function Photo({ photo, frame, url, editable, label, onMove, snapTargets, onGuides }: {
  photo: DeckPhoto;
  frame: Rect;
  url: string | undefined;
  editable: boolean;
  label: string;
  onMove?: (rect: Rect) => void;
  snapTargets: readonly Rect[];
  onGuides: (guides: Guides | null) => void;
}): JSX.Element {
  return (
    <Draggable rect={photoRect(photo, frame)} editable={editable} label={label} resize="aspect" onMove={onMove} snapTargets={snapTargets} onGuides={onGuides} style={{ boxShadow: '0 0.3cqw 0.8cqw rgba(0,0,0,0.18)' }}>
      {url ? (
        <img src={url} alt="" draggable={false} className="pointer-events-none h-full w-full select-none object-fill" />
      ) : (
        <div className="h-full w-full" style={{ background: hex(PALETTE_B.boxLine) }} />
      )}
    </Draggable>
  );
}

function Table({ rect, columns, rows, children }: { rect: Rect; columns: readonly number[]; rows: string; children: ReactNode }): JSX.Element {
  const box = useBox();
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
  onMoveText,
  className = '',
  tall = false,
}: {
  slide: DeckSlide;
  urls: ReadonlyMap<string, string>;
  editable?: boolean;
  onMovePhoto?: (imageId: string, rect: Rect) => void;
  onMoveText?: (rect: Rect) => void;
  className?: string;
  /** 4:3 slides (the optional taller deck). */
  tall?: boolean;
}): JSX.Element {
  const GEOMETRY = geometryFor(tall);
  const [guides, setGuides] = useState<Guides | null>(null);
  const slideH = slideHeight(tall);
  const box = (r: Rect): CSSProperties => boxIn(r, slideH);
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
        <Table rect={GEOMETRY.soapTable} columns={GEOMETRY.soapCols} rows={`${(GEOMETRY.soapHeaderH / slideH) * 100}% 1fr`}>
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
              snapTargets={[GEOMETRY.pageTitle, ...frames, ...slide.photos.flatMap((other, j) => (j === index ? [] : [photoRect(other, frames[Math.min(j, frames.length - 1)]!)]))]}
              onGuides={setGuides}
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
          <Draggable rect={slide.rect} editable={editable} label="Kotak teks" resize="free" onMove={onMoveText} snapTargets={[GEOMETRY.pageTitle, GEOMETRY.textOnly]} onGuides={setGuides} style={cellStyle(PALETTE_B.body)}>
            <NoteText text={slide.body} size={slide.fontPt} align={slide.align} />
          </Draggable>
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
      className={`relative ${tall ? 'aspect-[4/3]' : 'aspect-video'} w-full select-none overflow-hidden rounded-md shadow-card ring-1 ring-black/10 [container-type:size] ${className}`}
    >
      <SlideH.Provider value={slideH}>{content}</SlideH.Provider>
      {guides?.x.map((x) => (
        <div key={`gx${x}`} aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-[4]" style={{ left: `${(x / SLIDE_W) * 100}%`, borderLeft: `1px dashed ${hex(PALETTE_B.accent)}` }} />
      ))}
      {guides?.y.map((y) => (
        <div key={`gy${y}`} aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[4]" style={{ top: `${(y / slideH) * 100}%`, borderTop: `1px dashed ${hex(PALETTE_B.accent)}` }} />
      ))}
    </div>
  );
}
