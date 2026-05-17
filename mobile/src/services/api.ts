// Base API client. Backend (FastAPI on DigitalOcean) unchanged from frontend.
// Configure via EXPO_PUBLIC_API_URL in mobile/.env (auto-loaded by Expo SDK 55).

const RAW_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export function apiBase(): string {
  return RAW_BASE.replace(/\/$/, '');
}

export function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const base = apiBase();
  const search = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) search.set(k, String(v));
    }
  }
  const qs = search.toString();
  return `${base}${path}${qs ? `?${qs}` : ''}`;
}

export async function fetchJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 10000, ...rest } = init ?? {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: ctrl.signal });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      const d = body?.detail ?? body?.message;
      detail = typeof d === 'string' ? d : JSON.stringify(d ?? body);
    } catch {
      detail = res.statusText;
    }
    const err = new Error(`HTTP ${res.status}: ${detail}`);
    (err as { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}
