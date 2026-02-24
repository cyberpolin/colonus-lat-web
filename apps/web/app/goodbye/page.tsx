"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Main } from "@/components/ui/main";
import { useColonusStore } from "@/lib/store";

export default function GoodbyePage() {
  const logout = useColonusStore((state) => state.logout);
  const appName = "COLONUS";

  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <Main
      eyebrow="COLONUS"
      title="Goodbye"
      description="You have been signed out."
      maxWidthClassName="max-w-2xl"
    >
      <section id="goodbye-main-card" className="rounded-2xl rounded-t-none border border-slate-200 bg-white p-6 shadow-sm">
        <div className="m-4 flex flex-col items-center justify-center gap-4 text-center">
          <h3 className="text-xl font-semibold text-slate-900">Thanks for using {appName}</h3>
          <p className="text-sm text-slate-700">See you soon.</p>
          <Link href="/login" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Sign In Again
          </Link>
        </div>
      </section>
    </Main>
  );
}
