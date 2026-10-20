/**
 * Unit testovi: ApiClient (src/lib/api/client.ts).
 *
 * fetch je zamenjen lažnim, pa se proverava: slanje jezika i JSON tela,
 * query parametri, 204 i pretvaranje greške u ApiClientError sa kodom.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiClientError } from "@/lib/api/client";

/** Zamenjuje globalni fetch funkcijom koja vraća zadati odgovor. */
function mockFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiClient", () => {
  // GET sa query parametrima; prazne vrednosti se izostavljaju.
  it("šalje GET sa jezikom i query parametrima", async () => {
    const fetchMock = mockFetch(Response.json({ items: [] }));
    const api = new ApiClient("en");

    const data = await api.get("/tickets", {
      page: 2,
      status: "open",
      q: "",
      assigneeId: undefined,
    });
    expect(data).toEqual({ items: [] });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tickets?page=2&status=open");
    expect((init.headers as Record<string, string>)["Accept-Language"]).toBe("en");
  });

  // POST šalje JSON telo.
  it("šalje POST sa JSON telom", async () => {
    const fetchMock = mockFetch(Response.json({ id: "1" }, { status: 201 }));
    await new ApiClient("sr").post("/tickets", { title: "Naslov" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ title: "Naslov" }));
  });

  it("204 vraća undefined", async () => {
    mockFetch(new Response(null, { status: 204 }));
    expect(await new ApiClient("sr").post("/notifications/1/read")).toBeUndefined();
  });

  // Greška iz API-ja postaje ApiClientError sa kodom (UI ga prevodi).
  it("greška postaje ApiClientError sa kodom", async () => {
    mockFetch(
      Response.json(
        { error: { code: "TICKET_CLOSED", message: "...", details: { a: 1 } } },
        { status: 409 },
      ),
    );
    const error = await new ApiClient("sr")
      .post("/tickets/1/comments", {})
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: "TICKET_CLOSED", status: 409, details: { a: 1 } });
  });

  // Nepoznat oblik greške (npr. HTML stranica proxy-ja) postaje INTERNAL_ERROR.
  it("nepoznat odgovor postaje INTERNAL_ERROR", async () => {
    mockFetch(new Response("<html>502</html>", { status: 502 }));
    await expect(new ApiClient("sr").get("/me")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 502,
    });
  });
});
