import Link from "next/link";
import { Main } from "@/components/ui/main";

export default function ErrorRoutePage() {
  return (
    <Main
      eyebrow="COLONUS"
      title="Something Went Wrong"
      description="This is a generic error route for fallback navigation and support workflows."
      maxWidthClassName="max-w-2xl"
    >
      <section id="error-main-card" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Go Home
          </Link>
          <Link href="/login" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Open Login
          </Link>
          <Link href="/superadmin" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:border-slate-500">
            Super Admin
          </Link>
        </div>
      </section>
    </Main>
  );
}
