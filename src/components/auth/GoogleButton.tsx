/**
 * Fajl: src/components/auth/GoogleButton.tsx
 * Svrha: dugme „Nastavi sa Google nalogom“ (UC-03) na stranicama /login i /register.
 * To je običan link na GET /api/auth/google, koji pregledač preusmerava na Google;
 * posle prijave Google vraća korisnika na /api/auth/callback.
 * Povezano sa: src/app/api/auth/google/route.ts, docs/05 SD-03.
 */
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/**
 * Dugme za Google prijavu (serverska komponenta).
 * Ulaz: next — putanja na koju se korisnik vraća posle prijave.
 * Uloge: gost.
 */
export async function GoogleButton({ next }: { next: string }) {
  const t = await getTranslations("auth");
  const href = `/api/auth/google?next=${encodeURIComponent(next)}`;

  return (
    <Button asChild variant="outline" className="w-full">
      {/* Običan <a>, ne Next.js Link: odlazi se na API rutu koja preusmerava van aplikacije. */}
      <a href={href}>
        <GoogleLogo />
        {t("google")}
      </a>
    </Button>
  );
}

/** Google „G“ logo (zvanične boje), samo ukras — čitač ekrana ga preskače. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  );
}
