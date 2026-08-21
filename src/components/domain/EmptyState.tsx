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
        "cb-glass-card flex flex-col items-center justify-center border-dashed p-10 text-center sm:p-14",
        className,
      )}
    >
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cb-cyan-050 to-cb-cyan-100 text-cb-cyan-600 ring-1 ring-cb-cyan-100 dark:from-cb-cyan-900/40 dark:to-cb-cyan-800/30 dark:ring-cb-cyan-700/40">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <h3 className="text-lg font-extrabold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
