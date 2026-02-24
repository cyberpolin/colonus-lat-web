import { redirect } from "next/navigation";

export default async function TenantOnboardingLegacyRedirect({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ? `?token=${encodeURIComponent(params.token)}` : "";
  redirect(`/onboarding${token}`);
}
