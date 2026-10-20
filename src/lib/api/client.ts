/**
 * Fajl: src/lib/api/client.ts
 * Svrha: ApiClient — jedini način na koji interfejs (klijentske komponente)
 * poziva API rute. Omotač oko fetch-a koji:
 *   - šalje i prima JSON i šalje izabrani jezik (Accept-Language)
 *   - grešku iz API-ja pretvara u ApiClientError sa kodom, koji UI prevodi
 *     (t(`errors.${error.code}`))
 * Koriste ga: forme i hook-ovi od Faze 4 nadalje.
 * Povezano sa: withApi i ApiErrorHandler (oblik greške), src/lib/errors/codes.ts.
 */
import { isErrorCode, type ErrorCode } from "@/lib/errors/codes";
import type { Locale } from "@/lib/i18n/config";

/** Greška iz API poziva, sa kodom za prevod. */
export class ApiClientError extends Error {
  /**
   * Ulaz: kod greške (nepoznat kod postaje INTERNAL_ERROR), HTTP status i
   * opcioni detalji (npr. details.fields za greške po poljima forme).
   */
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "ApiClientError";
  }
}

/** Vrednosti query parametara. */
type QueryValue = string | number | boolean | undefined | null;

/** Klijent za API aplikacije. */
export class ApiClient {
  /**
   * Ulaz: jezik (za poruke grešaka iz API-ja) i osnovna putanja (podrazumevano /api).
   */
  constructor(
    private readonly locale: Locale,
    private readonly baseUrl = "/api",
  ) {}

  /** GET zahtev; query parametri bez vrednosti se izostavljaju. */
  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>("GET", path + toQueryString(query));
  }

  /** POST zahtev sa JSON telom. */
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /** PATCH zahtev sa JSON telom. */
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  /** DELETE zahtev. */
  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Zajednički deo svih zahteva.
   * Vraća: JSON odgovor, ili undefined za 204 No Content.
   * Baca: ApiClientError ako API vrati grešku ili mreža nije dostupna.
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // Korak 1: slanje zahteva (kolačić sesije ide automatski, isti domen).
    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, {
        method,
        headers: {
          Accept: "application/json",
          "Accept-Language": this.locale,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiClientError("INTERNAL_ERROR", 0);
    }

    // Korak 2: uspešan odgovor.
    if (response.status === 204) return undefined as T;
    const data: unknown = await response.json().catch(() => undefined);
    if (response.ok) return data as T;

    // Korak 3: greška u obliku { error: { code, details } }.
    const error = (data as { error?: { code?: unknown; details?: Record<string, unknown> } })
      ?.error;
    const code = isErrorCode(error?.code) ? error.code : "INTERNAL_ERROR";
    throw new ApiClientError(code, response.status, error?.details);
  }
}

/** Pravi "?a=1&b=2" od objekta; prazne vrednosti preskače. */
function toQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
