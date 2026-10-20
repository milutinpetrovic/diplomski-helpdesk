/**
 * Fajl: src/app/(app)/profile/page.tsx
 * Svrha: stranica /profile — pregled i izmena sopstvenog profila (UC-06):
 *   - lični podaci: ime, email (samo prikaz), uloga (samo prikaz), jezik
 *   - promena lozinke (samo za naloge sa lozinkom; Google nalog lozinku nema)
 * Pristup: customer, agent, admin.
 * Povezano sa: ProfileForm, NewPasswordForm, GET/PATCH /api/me, POST /api/auth/password/reset.
 */
import { getTranslations } from "next-intl/server";

import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/server-session";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

/** Stranica profila (serverska komponenta; forme su klijentske). */
export default async function ProfilePage() {
  const { ctx, profile } = await requireCurrentUser();
  const t = await getTranslations();

  // Korak 1: da li nalog ima lozinku (prijava emailom) ili samo Google prijavu.
  const { data } = await ctx.db.auth.getUser();
  const providers = data.user?.identities?.map((identity) => identity.provider) ?? [];
  const hasPassword = providers.length === 0 || providers.includes("email");

  return (
    <>
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lični podaci. */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("profile.detailsTitle")}</h2>
            </CardTitle>
            <CardDescription>
              {t("profile.role")}: {t(`roles.${profile.role}`)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>

        {/* Promena lozinke. */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("profile.passwordTitle")}</h2>
            </CardTitle>
            <CardDescription>
              {hasPassword ? t("profile.passwordDescription") : t("profile.googleAccount")}
            </CardDescription>
          </CardHeader>
          {hasPassword ? (
            <CardContent>
              <NewPasswordForm
                submitLabel={t("profile.passwordSave")}
                successMessage={t("profile.passwordSaved")}
              />
            </CardContent>
          ) : null}
        </Card>
      </div>
    </>
  );
}
