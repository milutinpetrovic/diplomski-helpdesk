/**
 * Unit testovi: AuthGuard (src/lib/auth/auth-guard.ts).
 *
 * Supabase klijent je zamenjen lažnim objektom koji vraća zadatog korisnika
 * i profil, pa se proverava sama logika: ko je prijavljen, aktivan nalog i
 * dozvoljena uloga.
 */
import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import type { DbClient } from "@/lib/supabase/types";

// server.ts koristi next/headers (radi samo u Next.js-u); ovde nije potreban.
vi.mock("@/lib/supabase/server", () => ({}));

const { getAuthContext, requireRole } = await import("@/lib/auth/auth-guard");

/**
 * Lažni Supabase klijent.
 * Ulaz: korisnik iz Auth-a (null = niko nije prijavljen) i profil
 * (null = RLS ga ne vraća, tj. nalog je deaktiviran).
 */
function fakeDb(user: { id: string } | null, profile: { role: string; locale: string } | null) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }),
      }),
    }),
  } as unknown as DbClient;
}

const USER = { id: "00000000-0000-4000-8000-000000000004" };

describe("getAuthContext", () => {
  // Niko nije prijavljen.
  it("vraća null bez sesije", async () => {
    expect(await getAuthContext({ db: fakeDb(null, null), accessToken: null })).toBeNull();
  });

  // Prijavljen i aktivan: uloga i jezik iz profila.
  it("vraća ulogu i jezik iz profila", async () => {
    const auth = await getAuthContext({
      db: fakeDb(USER, { role: "customer", locale: "en" }),
      accessToken: null,
    });
    expect(auth).toMatchObject({ userId: USER.id, role: "customer", locale: "en" });
    expect(auth?.isStaff()).toBe(false);
  });

  // Deaktiviran nalog: RLS ne vraća profil -> ACCOUNT_DISABLED.
  it("deaktiviran nalog baca ACCOUNT_DISABLED", async () => {
    await expect(
      getAuthContext({ db: fakeDb(USER, null), accessToken: null }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });
  });

  // Bearer token se prosleđuje Supabase Auth-u na proveru.
  it("proverava Bearer token", async () => {
    const db = fakeDb(USER, { role: "agent", locale: "sr" });
    await getAuthContext({ db, accessToken: "jwt-token" });
    expect(db.auth.getUser).toHaveBeenCalledWith("jwt-token");
  });
});

describe("requireRole", () => {
  it("bez sesije baca UNAUTHENTICATED", async () => {
    const error = await requireRole({ db: fakeDb(null, null), accessToken: null }, [
      "customer",
    ]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "UNAUTHENTICATED", httpStatus: 401 });
  });

  it("pogrešna uloga baca FORBIDDEN", async () => {
    await expect(
      requireRole({ db: fakeDb(USER, { role: "customer", locale: "sr" }), accessToken: null }, [
        "admin",
      ]),
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });

  it("dozvoljena uloga vraća AuthContext", async () => {
    const auth = await requireRole(
      { db: fakeDb(USER, { role: "admin", locale: "sr" }), accessToken: null },
      ["agent", "admin"],
    );
    expect(auth.isAdmin()).toBe(true);
  });
});
