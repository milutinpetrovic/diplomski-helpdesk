/**
 * Fajl: src/components/auth/AuthDivider.tsx
 * Svrha: linija sa rečju „ili“ između forme i dugmeta za Google prijavu.
 * Koriste je: stranice /login i /register.
 */
import { getTranslations } from "next-intl/server";

/** Razdelnik „— ili —“ (serverska komponenta). */
export async function AuthDivider() {
  const t = await getTranslations("common");
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
      <span className="h-px flex-1 bg-border" />
      {t("or")}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
