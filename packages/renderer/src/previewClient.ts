import type { ResumeDoc } from '../../core/src/schema';
import { compileResume } from './compile';
import type { CompileRequest, WorkerResponse } from './worker';

export interface PdfPreviewOptions {
  /** Called with fresh PDF bytes each time a (non-stale) compile succeeds. */
  onFrame(bytes: Uint8Array): void;
  /** Called with a message when a compile fails. The last good frame is kept. */
  onError(msg: string): void;
  /** Debounce window for `setDoc`; defaults to 300ms. */
  debounceMs?: number;
}

/**
 * Drives live PDF preview compilation.
 *
 * - Compiles in a module Web Worker; on worker construction/first-job failure it
 *   transparently falls back to main-thread compilation.
 * - Debounces `setDoc` (300ms default).
 * - jobIds increase monotonically; results older than the latest issued job are
 *   dropped as stale. The caller keeps the previous canvas until the next
 *   `onFrame`, so nothing flickers between edits.
 */
export class PdfPreviewController {
  private readonly onFrame: (bytes: Uint8Array) => void;
  private readonly onError: (msg: string) => void;
  private readonly debounceMs: number;

  private worker: Worker | null = null;
  private workerBroken = false;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingDoc: ResumeDoc | null = null;

  /** Highest jobId issued so far; a result is stale if its jobId is lower. */
  private latestIssued = 0;
  private disposed = false;

  constructor(opts: PdfPreviewOptions) {
    this.onFrame = opts.onFrame;
    this.onError = opts.onError;
    this.debounceMs = opts.debounceMs ?? 300;
  }

  setDoc(doc: ResumeDoc): void {
    if (this.disposed) return;
    this.pendingDoc = doc;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.pendingDoc;
      this.pendingDoc = null;
      if (next) this.issue(next);
    }, this.debounceMs);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  // --- internals -----------------------------------------------------------

  private issue(doc: ResumeDoc): void {
    const jobId = ++this.latestIssued;
    if (!this.workerBroken && this.ensureWorker()) {
      try {
        const req: CompileRequest = { type: 'compile', jobId, doc };
        this.worker!.postMessage(req);
        return;
      } catch {
        this.breakWorker();
      }
    }
    this.compileOnMainThread(jobId, doc);
  }

  private ensureWorker(): boolean {
    if (this.worker) return true;
    if (typeof Worker === 'undefined') {
      this.workerBroken = true;
      return false;
    }
    try {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (ev: MessageEvent<WorkerResponse>) => this.handleResponse(ev.data);
      worker.onerror = () => this.breakWorker();
      this.worker = worker;
      return true;
    } catch {
      this.workerBroken = true;
      return false;
    }
  }

  private breakWorker(): void {
    this.workerBroken = true;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    // Retry the most recent job on the main thread so the preview still updates.
    const doc = this.pendingDoc;
    if (doc && !this.disposed) {
      this.compileOnMainThread(this.latestIssued, doc);
    }
  }

  private handleResponse(res: WorkerResponse): void {
    if (this.disposed) return;
    if (res.jobId < this.latestIssued) return; // stale, superseded
    if (res.type === 'done') {
      this.onFrame(res.bytes);
    } else {
      this.onError(res.message);
    }
  }

  private compileOnMainThread(jobId: number, doc: ResumeDoc): void {
    compileResume(doc).then(
      (bytes) => {
        if (this.disposed || jobId < this.latestIssued) return;
        this.onFrame(bytes);
      },
      (err: unknown) => {
        if (this.disposed || jobId < this.latestIssued) return;
        this.onError(err instanceof Error ? err.message : String(err));
      },
    );
  }
}
