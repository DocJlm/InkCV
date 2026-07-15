/**
 * Best-effort JSON extraction from an LLM response, which may wrap JSON in
 * ```json fences or surround it with prose. Handles both top-level objects and
 * arrays.
 */
import { AiError } from './errors';

export function extractJson(s: string): unknown {
  const text = (s ?? '').trim();

  let candidate = text;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1] !== undefined) {
    candidate = fence[1].trim();
  } else {
    // Slice from the first opening bracket/brace to the last closing one.
    const starts = [candidate.indexOf('{'), candidate.indexOf('[')].filter((i) => i >= 0);
    const ends = [candidate.lastIndexOf('}'), candidate.lastIndexOf(']')];
    const start = starts.length > 0 ? Math.min(...starts) : -1;
    const end = Math.max(...ends);
    if (start >= 0 && end > start) {
      candidate = candidate.slice(start, end + 1);
    }
  }

  try {
    return JSON.parse(candidate);
  } catch {
    throw new AiError('parse', `Could not parse JSON from response: ${candidate.slice(0, 200)}`);
  }
}
