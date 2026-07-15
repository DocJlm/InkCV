/**
 * Typed error for all AI operations. `kind` lets the UI show a targeted message
 * (e.g. "check your API key" for `auth`, "check your network" for `network`).
 */
export type AiErrorKind = 'auth' | 'network' | 'parse' | 'api';

export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
    // Restore prototype chain for `instanceof` across transpile targets.
    Object.setPrototypeOf(this, AiError.prototype);
  }
}
