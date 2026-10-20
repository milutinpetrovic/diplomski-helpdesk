/**
 * Fajl: src/lib/api/with-api.ts
 * Svrha: withApi — omotač kroz koji prolazi SVAKA API ruta. Na jednom mestu radi:
 *   1. proveru prijave i uloge (401 / 403)
 *   2. Zod proveru ulaza: telo, query parametri i parametri putanje (400)
 *   3. pravljenje ServiceContext-a za servis
 *   4. pretvaranje rezultata u JSON odgovor
 *   5. jedinstvenu obradu grešaka (ApiErrorHandler)
 * Tako svaka ruta ima samo nekoliko linija: šta prima i koji servis poziva.
 * Koriste ga: src/app/api/**\/route.ts.
 * Povezano sa: AuthGuard, ApiErrorHandler, ServiceContext, docs/07 (obrazac rute).
 */
import type { z } from "zod";

import { createRequestClient, requireRole } from "@/lib/auth/auth-guard";
import { AppError } from "@/lib/errors/app-error";
import { localeFromRequest, toErrorResponse } from "@/lib/errors/handler";
import { getRealtimePublisher } from "@/lib/realtime";
import type { ServiceContext } from "@/services/service-context";
import type { UserRole } from "@/types/domain";

/** Zod šema ili ništa (ako ruta ne prima taj deo ulaza). */
type MaybeSchema = z.ZodType | undefined;

/** Tip proverenih podataka za šemu (undefined ako šeme nema). */
type Parsed<S extends MaybeSchema> = S extends z.ZodType ? z.output<S> : undefined;

/** Podešavanja rute. */
export interface ApiRouteOptions<
  B extends MaybeSchema,
  Q extends MaybeSchema,
  P extends MaybeSchema,
> {
  /** Uloge koje smeju da pozovu rutu, ili "public" (bez prijave). */
  roles: readonly UserRole[] | "public";
  /** Šema JSON tela zahteva. */
  body?: B;
  /** Šema query parametara (?page=1&status=open). */
  query?: Q;
  /** Šema parametara putanje (/api/tickets/{id}). */
  params?: P;
  /** HTTP status uspešnog odgovora sa telom (podrazumevano 200; 201 za kreiranje). */
  successStatus?: number;
}

/** Ono što ruta dobija posle svih provera. */
export interface ApiHandlerArgs<
  B extends MaybeSchema,
  Q extends MaybeSchema,
  P extends MaybeSchema,
  C,
> {
  request: Request;
  /** ServiceContext za rute sa prijavom; null za javne rute. */
  ctx: C;
  body: Parsed<B>;
  query: Parsed<Q>;
  params: Parsed<P>;
}

/** Drugi argument koji Next.js prosleđuje ruti (parametri putanje). */
export interface RouteContext {
  params: Promise<Record<string, string | string[] | undefined>>;
}

/** Funkcija koju ruta izvozi (GET, POST...). */
export type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

/** Rezultat rute: podaci (JSON), gotov Response, ili ništa (204 No Content). */
type HandlerResult = unknown;

/**
 * Ruta koja traži prijavu: roles je spisak uloga, handler dobija ServiceContext.
 */
export function withApi<
  B extends MaybeSchema = undefined,
  Q extends MaybeSchema = undefined,
  P extends MaybeSchema = undefined,
>(
  options: ApiRouteOptions<B, Q, P> & { roles: readonly UserRole[] },
  handler: (args: ApiHandlerArgs<B, Q, P, ServiceContext>) => Promise<HandlerResult>,
): RouteHandler;
/**
 * Javna ruta: roles = "public", handler dobija ctx = null.
 */
export function withApi<
  B extends MaybeSchema = undefined,
  Q extends MaybeSchema = undefined,
  P extends MaybeSchema = undefined,
>(
  options: ApiRouteOptions<B, Q, P> & { roles: "public" },
  handler: (args: ApiHandlerArgs<B, Q, P, null>) => Promise<HandlerResult>,
): RouteHandler;
export function withApi(
  options: ApiRouteOptions<MaybeSchema, MaybeSchema, MaybeSchema>,
  // Tačan tip handlera garantuju dva potpisa iznad; ovde je opšti oblik.
  handler: (args: never) => Promise<HandlerResult>,
): RouteHandler {
  const run = handler as (
    args: ApiHandlerArgs<MaybeSchema, MaybeSchema, MaybeSchema, ServiceContext | null>,
  ) => Promise<HandlerResult>;
  return async (request, context) => {
    const locale = localeFromRequest(request);
    try {
      // Korak 1: prijava i uloga (samo za rute koje nisu javne).
      let ctx: ServiceContext | null = null;
      if (options.roles !== "public") {
        const client = await createRequestClient(request);
        const auth = await requireRole(client, options.roles);
        ctx = { db: client.db, auth, publisher: getRealtimePublisher(client.db) };
      }

      // Korak 2: provera ulaza (ZodError -> 400 VALIDATION_ERROR u handleru grešaka).
      const params = options.params?.parse(await context.params);
      const query = options.query?.parse(Object.fromEntries(new URL(request.url).searchParams));
      const body = options.body?.parse(await readJsonBody(request));

      // Korak 3: poslovna logika (servis).
      const result = await run({ request, ctx, body, query, params });

      // Korak 4: odgovor.
      if (result instanceof Response) return result;
      if (result === undefined) return new Response(null, { status: 204 });
      return Response.json(result, { status: options.successStatus ?? 200 });
    } catch (error) {
      // Korak 5: svaka greška u istom JSON obliku.
      return toErrorResponse(error, locale);
    }
  };
}

/** Čita JSON telo; neispravan JSON je VALIDATION_ERROR (400), a ne 500. */
async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", { reason: "INVALID_JSON" });
  }
}
