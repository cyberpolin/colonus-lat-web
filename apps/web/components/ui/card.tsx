"use client";

import { useId, useState, type ReactNode } from "react";
import { cn, toDescriptiveId } from "@/lib/ui";

interface CardProps {
  id?: string;
  title?: string;
  eyebrow?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  clickable?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function Card({
  id,
  title,
  eyebrow,
  footer,
  children,
  className,
  clickable = false,
  collapsible = false,
  defaultCollapsed = false
}: CardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const reactId = useId().replace(/[^a-z0-9_-]/gi, "");
  const source = title ?? eyebrow ?? "card";
  const resolvedId = id ?? `card-${toDescriptiveId(source)}-${reactId}`;

  return (
    <section
      id={resolvedId}
      className={cn(
        "rounded-md border border-slate-200 bg-white p-4 shadow-sm md:p-6",
        clickable && "cursor-pointer transition hover:border-slate-400",
        className
      )}
    >
      {(eyebrow || title || collapsible) && (
        <div className={cn("flex items-start justify-between gap-2", (eyebrow || title) && "mb-3")}>
          <div>
            {eyebrow && <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>}
            {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
          </div>
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed((current) => !current)}
              className="inline-flex h-7 min-w-7 items-center justify-center rounded border border-slate-300 px-2 text-xs text-slate-700 hover:border-slate-500"
              aria-label={isCollapsed ? "Expand card" : "Collapse card"}
            >
              {isCollapsed ? "v" : "^"}
            </button>
          )}
        </div>
      )}

      {!isCollapsed && <div>{children}</div>}
      {!isCollapsed && footer && <div className="mt-4 border-t border-slate-200 pt-3">{footer}</div>}
    </section>
  );
}
