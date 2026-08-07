const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init
  });
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string; title?: string; message?: string; errors?: Record<string, string[]> };
      message = body.detail ?? body.message ?? body.title ?? Object.values(body.errors ?? {}).flat().join(' ') ?? message;
    } catch {
      // The HTTP status remains the useful fallback.
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const get = <T>(path: string) => apiRequest<T>(path);
export const post = <T>(path: string, body?: unknown, init?: RequestInit) => apiRequest<T>(path, { ...init, method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' });
