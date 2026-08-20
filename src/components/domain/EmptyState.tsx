import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title = "Sem dados",
  description = "Nada por aqui ainda.",
  icon,
  action,
  className,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10 text-center backdrop-blur-sm sm:p-12",
        className,
      )}
    >
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cb-cyan-050 text-cb-cyan-600 ring-1 ring-cb-cyan-100 dark:bg-cb-cyan-900/30 dark:ring-cb-cyan-700/30">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
