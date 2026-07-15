import type { ResumeDoc } from '../../core/src/schema';
import { compileResume } from './compile';

/**
 * Module Web Worker entry for off-main-thread PDF compilation.
 * Instantiate with `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.
 */

export interface CompileRequest {
  type: 'compile';
  jobId: number;
  doc: ResumeDoc;
}

export interface DoneResponse {
  type: 'done';
  jobId: number;
  bytes: Uint8Array;
}

export interface ErrorResponse {
  type: 'error';
  jobId: number;
  message: string;
}

export type WorkerResponse = DoneResponse | ErrorResponse;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (ev: MessageEvent<CompileRequest>) => {
  const msg = ev.data;
  if (!msg || msg.type !== 'compile') return;

  const { jobId, doc } = msg;
  try {
    const bytes = await compileResume(doc);
    const done: DoneResponse = { type: 'done', jobId, bytes };
    ctx.postMessage(done, [bytes.buffer as ArrayBuffer]);
  } catch (err) {
    const error: ErrorResponse = {
      type: 'error',
      jobId,
      message: err instanceof Error ? err.message : String(err),
    };
    ctx.postMessage(error);
  }
};
