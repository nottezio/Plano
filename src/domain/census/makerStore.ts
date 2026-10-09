import { addDays } from '@/domain/clinicalDate';
import type { ClinicalDate } from '@/domain/types';
import { PLACE_ORDER, type AiPatient, type AiUncertain, type CensusAddress, type IdentityStyle, type SourceKind } from './maker';

/**
 * Buat Sensus, on this device: the pasted lists PER DAY, and the AI result.
 *
 * WHY PER DAY (Avi, 2026-10-09: "the sensus is made each day, so the boxes
 * should be for that day only"). Version 1 kept one set of boxes and emptied
 * it when the clinical date changed. That made the boxes belong to whatever
 * day the phone thought it was, not to the census being made: a census for
 * yesterday, finished after the rollover, opened on empty boxes, and
 * yesterday's lists could never be opened again. Now the boxes belong to the
 * tanggal sensus: each date has its own lists, and switching the date
 * switches the boxes.
 *
 * WHY THE AI RESULT IS KEPT. It cost an API call and a minute of waiting, and
 * it lived only in component state, so opening Tersimpan (another tab, which
 * unmounts this one) or a reload threw it away. It is kept per day and per
 * DPJP, with the key of what it was computed from, so it shows again only
 * while it still matches the lists.
 *
 * Still device-only, for the reasons in SensusMaker: whole-hospital lists,
 * tens of KB each. Kept `KEEP_DAYS` days, then dropped.
 */

export const SENSUS_STORE_KEY = 'plano.sensus.v2';
export const SENSUS_STORE_V1_KEY = 'plano.sensus.v1';
export const KEEP_DAYS = 7;

export interface SensusList {
  text: string;
  kind: SourceKind | 'auto';
}

export interface SensusAiResult {
  /** What it was computed from (`aiKey` in SensusMaker); a change makes it stale. */
  key: string;
  /** The message as first built. Shown only when `patients` is absent (stored by 09.2). */
  text: string;
  /**
   * The patients the AI returned, as corrected since ("Buang", "Tambahkan",
   * "Pakai diagnosis Aturan"). The message is built from these.
   */
  patients?: AiPatient[];
  /** Patients the AI was unsure of, with its reason: the "Perlu dicek" box. */
  uncertain?: AiUncertain[];
}

export interface SensusDay {
  lists: SensusList[];
  /** By DPJP code. */
  ai: Record<string, SensusAiResult>;
  /**
   * By DPJP code: patients from "Perlu dicek" the user chose to include
   * (entry keys, `rm:…`). A decision, so it holds in both modes.
   */
  extra: Record<string, string[]>;
}

export interface SensusStore {
  days: Record<string, SensusDay>;
  code: string;
  address: CensusAddress;
  style: IdentityStyle;
  mode: 'aturan' | 'ai';
}

const EMPTY_LIST: SensusList = { text: '', kind: 'auto' };

export function emptyDay(): SensusDay {
  return { lists: [{ ...EMPTY_LIST }], ai: {}, extra: {} };
}

export function emptyStore(): SensusStore {
  return { days: {}, code: '', address: 'dokter', style: 'asis', mode: 'aturan' };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readLists(value: unknown): SensusList[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((list): list is Record<string, unknown> => isRecord(list) && typeof list.text === 'string')
    .map((list) => ({ text: list.text as string, kind: (typeof list.kind === 'string' ? list.kind : 'auto') as SensusList['kind'] }));
}

function readStoredPatients(value: unknown): AiPatient[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      place: PLACE_ORDER.find((place) => place === item.place) ?? 'PJT',
      identity: str(item.identity),
      diagnoses: Array.isArray(item.diagnoses) ? item.diagnoses.filter((d): d is string => typeof d === 'string') : [],
      rm: str(item.rm),
      sourceLine: str(item.sourceLine),
      dpjpFrom: str(item.dpjpFrom),
      kjs: str(item.kjs),
    }))
    .filter((patient) => patient.identity.trim() !== '');
}

function readAi(value: unknown): Record<string, SensusAiResult> {
  if (!isRecord(value)) return {};
  const out: Record<string, SensusAiResult> = {};
  for (const [code, entry] of Object.entries(value)) {
    if (isRecord(entry) && typeof entry.key === 'string' && typeof entry.text === 'string') {
      const patients = readStoredPatients(entry.patients);
      const uncertain = Array.isArray(entry.uncertain)
        ? (readStoredPatients(entry.uncertain) ?? []).map((patient, index) => {
            const item = (entry.uncertain as unknown[])[index];
            return { ...patient, reason: isRecord(item) && typeof item.reason === 'string' ? item.reason : '' };
          })
        : undefined;
      out[code] = {
        key: entry.key,
        text: entry.text,
        ...(patients ? { patients } : {}),
        ...(uncertain ? { uncertain } : {}),
      };
    }
  }
  return out;
}

function readExtra(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [code, keys] of Object.entries(value)) {
    if (Array.isArray(keys)) out[code] = keys.filter((key): key is string => typeof key === 'string');
  }
  return out;
}

function hasContent(day: SensusDay): boolean {
  return day.lists.some((list) => list.text.trim()) || Object.keys(day.ai).length > 0;
}

/** Days within the last `KEEP_DAYS` (and none after tomorrow: a wrong clock should not pin a day forever). */
export function pruneDays(days: Record<string, SensusDay>, today: ClinicalDate): Record<string, SensusDay> {
  const oldest = addDays(today, -KEEP_DAYS);
  const latest = addDays(today, 1);
  return Object.fromEntries(
    Object.entries(days).filter(([date, day]) => date >= oldest && date <= latest && hasContent(day)),
  );
}

/**
 * The stored state, from the v2 key or — once — from the v1 one, whose single
 * set of lists becomes the day it was saved for.
 */
export function readSensusStore(v2: string | null, v1: string | null, today: ClinicalDate): SensusStore {
  const store = emptyStore();
  try {
    const raw: unknown = v2 ? JSON.parse(v2) : v1 ? JSON.parse(v1) : null;
    if (!isRecord(raw)) return store;
    if (typeof raw.code === 'string') store.code = raw.code;
    if (raw.address === 'prof') store.address = 'prof';
    if (raw.style === 'front') store.style = 'front';
    if (raw.mode === 'ai') store.mode = 'ai';

    if (isRecord(raw.days)) {
      for (const [date, value] of Object.entries(raw.days)) {
        if (!ISO.test(date) || !isRecord(value)) continue;
        const lists = readLists(value.lists);
        store.days[date] = {
          lists: lists.length > 0 ? lists : [{ ...EMPTY_LIST }],
          ai: readAi(value.ai),
          extra: readExtra(value.extra),
        };
      }
    } else if (typeof raw.date === 'string' && ISO.test(raw.date)) {
      // v1: { date, lists, code, address, style }.
      const lists = readLists(raw.lists);
      if (lists.length > 0) store.days[raw.date] = { lists, ai: {}, extra: {} };
    }
  } catch {
    return emptyStore();
  }
  store.days = pruneDays(store.days, today);
  return store;
}

export function dayOf(store: SensusStore, date: string): SensusDay {
  return store.days[date] ?? emptyDay();
}

/** The store with `date` set to `day`; an emptied day is removed rather than kept. */
export function withDay(store: SensusStore, date: string, day: SensusDay): SensusStore {
  const days = { ...store.days };
  if (hasContent(day)) days[date] = day;
  else delete days[date];
  return { ...store, days };
}

/** Other days that have lists, newest first: the "switch day" chips. */
export function storedDays(store: SensusStore): Array<{ date: string; lists: number }> {
  return Object.entries(store.days)
    .map(([date, day]) => ({ date, lists: day.lists.filter((list) => list.text.trim()).length }))
    .filter((entry) => entry.lists > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Every place `needle` occurs in `text` (case-insensitive), as [start, end) offsets. */
export function findAll(text: string, needle: string): Array<[number, number]> {
  const query = needle.trim().toLowerCase();
  if (!query) return [];
  const haystack = text.toLowerCase();
  const found: Array<[number, number]> = [];
  for (let at = haystack.indexOf(query); at !== -1; at = haystack.indexOf(query, at + query.length)) {
    found.push([at, at + query.length]);
  }
  return found;
}

/** The whole line around offset `at`, for showing a match in context. */
export function lineAt(text: string, at: number): string {
  const start = text.lastIndexOf('\n', at - 1) + 1;
  const end = text.indexOf('\n', at);
  return text.slice(start, end === -1 ? undefined : end);
}
