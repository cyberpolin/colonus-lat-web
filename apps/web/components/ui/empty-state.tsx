import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
}

export function EmptyState({ title, message, actionLabel }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      {actionLabel && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" type="button">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
