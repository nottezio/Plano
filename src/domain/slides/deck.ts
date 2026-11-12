import type { ClinicalDate } from '@/domain/types';
import type { ImageLayout, Rect } from './geometry';

/**
 * The deck as the PPTX writer and the editor preview both see it: plain data,
 * already composed (order chosen, hidden slides dropped, text fitted). Nothing
 * here reads storage or the note.
 */

export interface DeckPhoto {
  imageId: string;
  bytes: Uint8Array;
  mime: 'image/jpeg' | 'image/png';
  widthPx: number;
  heightPx: number;
  /** Set once the resident moved or resized it; otherwise fitted inside the layout frame. */
  rect?: Rect;
}

export type DeckSlide =
  | { kind: 'title'; id: 'title'; heading: string[]; subtitle: string }
  | {
      kind: 'soap';
      id: string;
      date: ClinicalDate;
      identitas: string;
      col2: string;
      col3: string;
      fontPt: number;
    }
  | { kind: 'images'; id: string; title: string; layout: ImageLayout; photos: DeckPhoto[]; text?: string }
  | { kind: 'text'; id: string; title: string; body: string; fontPt: number; align: 'l' | 'ctr'; rect: Rect }
  | { kind: 'lab'; id: 'lab'; title: string; dates: string[]; rows: Array<{ label: string; cells: string[] }> }
  | { kind: 'closing'; id: 'closing' };

export interface Deck {
  slides: DeckSlide[];
  /** 4:3 slides (taller), for a long SOAP. Absent = 16:9. */
  tall?: boolean;
}
