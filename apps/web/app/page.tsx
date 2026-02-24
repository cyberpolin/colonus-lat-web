"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RoleSelector } from "@/components/role-selector";
import { useColonusStore } from "@/lib/store";

const APP_HOSTS = new Set(["app.colonus.lat"]);

export default function HomePage() {
  const router = useRouter();
  const authSession = useColonusStore((state) => state.authSession);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    if (!APP_HOSTS.has(host)) return;

    if (!authSession) {
      router.replace("/login");
      return;
    }

    if (authSession.role === "super_admin") {
      router.replace("/superadmin");
      return;
    }
    if (authSession.role === "landlord") {
      router.replace("/landlord");
      return;
    }
    router.replace("/tenant");
  }, [authSession, router]);

  return <RoleSelector />;
}
