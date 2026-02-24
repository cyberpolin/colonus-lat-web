import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <header
      data-colonus-page-header="true"
      className={cn(
        "relative left-1/2 right-1/2 w-screen -translate-x-1/2 border-b border-slate-600 bg-slate-700 text-slate-100",
        className
      )}
    >
      <div className={cn("mx-auto w-full max-w-6xl px-6 py-6 md:px-10", Boolean(actions) && "flex flex-wrap items-center justify-between gap-2")}>
        <div>
          {eyebrow && <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{eyebrow}</p>}
          <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
          {description && <p className="mt-2 text-sm text-slate-200">{description}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}
