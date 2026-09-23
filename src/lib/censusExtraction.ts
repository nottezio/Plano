import { AiError, askClaudeTool } from './ai';
import { DENAH_TOOL, LIST_TOOL, buildSystemPrompt } from '@/domain/census/schemas';
import {
  selfCheckProblems,
  type CensusKind,
  type DenahExtraction,
  type ListExtraction,
} from '@/domain/census/verify';

/**
 * Stages 0–3 in the browser: the `extract()` of `extraction.ts`, ported.
 *
 * Same model, token budget, retry and outcome as the original: one retry when
 * the self-check fails, and on the last attempt the data is returned WITH its
 * warnings rather than thrown away — a transcription with a flagged count is
 * still worth reading, and the flag says where to look.
 */
export const CENSUS_MODEL = 'claude-sonnet-5';

export type CensusResult<T> = T & { _extractionWarnings?: string[] };

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Chunked: `String.fromCharCode(...bytes)` on a multi-megabyte PDF exceeds
  // the argument limit and throws before anything is sent.
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export async function extractCensus(
  file: File,
  kind: 'DENAH',
  maxAttempts?: number,
): Promise<CensusResult<DenahExtraction>>;
export async function extractCensus(
  file: File,
  kind: 'LIST_PASIEN',
  maxAttempts?: number,
): Promise<CensusResult<ListExtraction>>;
export async function extractCensus(
  file: File,
  kind: CensusKind,
  maxAttempts = 2,
): Promise<CensusResult<DenahExtraction | ListExtraction>> {
  const tool = kind === 'DENAH' ? DENAH_TOOL : LIST_TOOL;
  const pdfBase64 = await fileToBase64(file);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { input, truncated } = await askClaudeTool({
      model: CENSUS_MODEL,
      system: buildSystemPrompt(kind),
      tool,
      pdfBase64,
      instruction: `Transcribe this ${kind} document by calling ${tool.name}.`,
      maxTokens: 16000,
    });
    if (truncated) {
      throw new AiError('Hasil terpotong: dokumen terlalu panjang untuk satu panggilan.');
    }

    const data = input as DenahExtraction | ListExtraction;
    const problems = selfCheckProblems(data, kind);
    if (problems.length === 0) return data;
    if (attempt === maxAttempts) return { ...data, _extractionWarnings: problems };
  }
  // Unreachable with maxAttempts >= 1; here for the type checker.
  throw new AiError('Transkripsi tidak menghasilkan data.');
}
