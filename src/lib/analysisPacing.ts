/** Max concurrent analyze-failures invocations (1 = fully sequential). Override via VITE_ANALYSIS_MAX_CONCURRENT. */
export const ANALYSIS_MAX_CONCURRENT = Math.max(
  1,
  Math.min(3, Number(import.meta.env.VITE_ANALYSIS_MAX_CONCURRENT) || 1),
);

/** Delay between row analyses to stay under OpenAI RPM/TPM. Override via VITE_ANALYSIS_ROW_DELAY_MS. */
export const ANALYSIS_ROW_DELAY_MS = Math.max(
  0,
  Number(import.meta.env.VITE_ANALYSIS_ROW_DELAY_MS) || 2000,
);

/** Client-side retries when the edge function returns HTTP 429. Override via VITE_ANALYSIS_RATE_LIMIT_RETRIES. */
export const ANALYSIS_RATE_LIMIT_RETRIES = Math.max(
  0,
  Number(import.meta.env.VITE_ANALYSIS_RATE_LIMIT_RETRIES) || 5,
);

/** Default wait when API omits Retry-After (OpenAI RPM windows are often 60s). */
export const ANALYSIS_RATE_LIMIT_DEFAULT_WAIT_MS = Math.max(
  5000,
  Number(import.meta.env.VITE_ANALYSIS_RATE_LIMIT_WAIT_MS) || 60000,
);

export type InvokeFailureDetails = {
  message: string;
  retryAfterMs?: number;
  code?: string;
};

export function isRateLimitMessage(msg: string): boolean {
  return /rate limit/i.test(msg) || /rate_limit_exceeded/i.test(msg);
}

/** Parse "try again in Xs" hints from OpenAI error bodies. */
export function parseRetryAfterFromText(text: string): number | undefined {
  const secMatch = text.match(/try again in ([\d.]+)\s*s/i);
  if (secMatch) {
    const sec = parseFloat(secMatch[1]);
    if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec * 1000);
  }
  const msMatch = text.match(/retry[- ]after[:\s]+([\d.]+)\s*ms/i);
  if (msMatch) {
    const ms = parseFloat(msMatch[1]);
    if (Number.isFinite(ms) && ms > 0) return Math.ceil(ms);
  }
  return undefined;
}

export function computeRateLimitWaitMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(Math.max(retryAfterMs, 5000), 120_000);
  }
  // 20s, 40s, 60s, 90s, 120s — aligned with typical OpenAI RPM reset windows
  const base = 20_000 * 2 ** Math.min(attempt, 3);
  return Math.min(base, 120_000);
}

export function formatInvokeError(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return 'Analysis failed';
}

/** Prefer JSON body from non-2xx function responses (e.g. HTTP 429). */
export async function extractInvokeFailureDetails(
  data: unknown,
  error: unknown,
): Promise<InvokeFailureDetails> {
  const fromBody = (body: Record<string, unknown>): InvokeFailureDetails | null => {
    const bodyErr = body.error;
    const code = typeof body.code === 'string' ? body.code : undefined;
    const retryAfterMs =
      typeof body.retryAfterMs === 'number' && body.retryAfterMs > 0
        ? body.retryAfterMs
        : typeof body.details === 'string'
          ? parseRetryAfterFromText(body.details)
          : undefined;

    if (typeof bodyErr === 'string' && bodyErr.trim()) {
      const message =
        code === 'rate_limit_exceeded' || isRateLimitMessage(bodyErr)
          ? 'Rate limit exceeded'
          : bodyErr;
      return { message, retryAfterMs, code };
    }
    return null;
  };

  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const parsed = fromBody(data as Record<string, unknown>);
    if (parsed) return parsed;
  }

  const ctx =
    error && typeof error === 'object' && error !== null && 'context' in error
      ? (error as { context?: unknown }).context
      : undefined;
  if (
    ctx &&
    typeof ctx === 'object' &&
    ctx !== null &&
    'json' in ctx &&
    typeof (ctx as { json: unknown }).json === 'function'
  ) {
    try {
      const body = (await (ctx as Response).clone().json()) as Record<string, unknown>;
      const parsed = fromBody(body);
      if (parsed) return parsed;

      const retryAfterHeader = (ctx as Response).headers?.get?.('retry-after');
      if (retryAfterHeader) {
        const sec = parseFloat(retryAfterHeader);
        if (Number.isFinite(sec) && sec > 0) {
          return {
            message: 'Rate limit exceeded',
            retryAfterMs: Math.ceil(sec * 1000),
            code: 'rate_limit_exceeded',
          };
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  const fallback = formatInvokeError(error);
  return {
    message: isRateLimitMessage(fallback) ? 'Rate limit exceeded' : fallback,
    retryAfterMs: parseRetryAfterFromText(fallback),
  };
}

/** @deprecated Use extractInvokeFailureDetails */
export async function extractInvokeFailureMessage(
  data: unknown,
  error: unknown,
): Promise<string> {
  const details = await extractInvokeFailureDetails(data, error);
  return details.message;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run async work over items with a concurrency cap and optional delay between task starts.
 * Default concurrency is 1 (sequential) to avoid flooding the LLM endpoint.
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options?: {
    concurrency?: number;
    /** Fixed delay, or a getter for adaptive throttling between rows. */
    delayMs?: number | (() => number);
    onItemComplete?: (index: number) => void;
  },
): Promise<R[]> {
  const concurrency = Math.max(1, options?.concurrency ?? ANALYSIS_MAX_CONCURRENT);
  const getDelayMs = () => {
    const d = options?.delayMs ?? ANALYSIS_ROW_DELAY_MS;
    return typeof d === 'function' ? d() : d;
  };
  const results: R[] = new Array(items.length);

  if (concurrency === 1) {
    for (let i = 0; i < items.length; i++) {
      results[i] = await fn(items[i], i);
      options?.onItemComplete?.(i);
      const delayMs = getDelayMs();
      if (delayMs > 0 && i < items.length - 1) {
        await sleep(delayMs);
      }
    }
    return results;
  }

  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;

      const delayMs = getDelayMs();
      if (delayMs > 0 && index > 0) {
        await sleep(delayMs);
      }

      results[index] = await fn(items[index], index);
      options?.onItemComplete?.(index);
    }
  });

  await Promise.all(workers);
  return results;
}
