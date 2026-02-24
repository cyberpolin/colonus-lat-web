import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/ui";

interface InfoCardProps {
  badge?: ReactNode;
  description: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function InfoCard({ badge, description, className, children }: InfoCardProps) {
  return (
    <Card className={cn("p-4 md:p-4", className)}>
      <div className="space-y-2">
        {badge}
        <p className="text-xs text-slate-600">{description}</p>
        {children}
      </div>
    </Card>
  );
}
