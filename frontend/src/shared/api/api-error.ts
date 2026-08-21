/**
 * A failed request, carrying the status and the server's own words.
 *
 * Errors used to be thrown as `API 409: {"detail":"..."}`, and every toast in
 * the app prints `error.message` — so the broker got a raw status line and a
 * JSON fragment for a message the backend had written in Spanish for them.
 * Callers that need to branch (403 vs 500) had to parse that string.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static async from(response: Response): Promise<ApiError> {
    const text = await response.text().catch(() => "");
    let body: unknown;
    let detail: string | undefined;
    try {
      body = JSON.parse(text);
      const d = (body as { detail?: unknown } | null)?.detail;
      // FastAPI validation errors put a list of objects in `detail`; those are
      // for developers, not for a toast.
      if (typeof d === "string") detail = d;
    } catch {
      body = text;
    }
    return new ApiError(response.status, detail || FALLBACK_BY_STATUS(response.status), body);
  }
}

const FALLBACK_BY_STATUS = (status: number): string => {
  if (status === 401) return "Tu sesión expiró. Vuelve a entrar.";
  if (status === 403) return "No tienes permiso para esto.";
  if (status === 404) return "No encontramos lo que buscabas.";
  if (status >= 500) return "El servidor tuvo un problema. Intenta de nuevo.";
  return "No se pudo completar la acción.";
};
