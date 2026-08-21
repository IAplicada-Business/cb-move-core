import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type HeaderInfoTooltipProps = {
  description: string;
  className?: string;
  iconClassName?: string;
};

export function HeaderInfoTooltip({
  description,
  className,
  iconClassName,
}: HeaderInfoTooltipProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-cb-muted/60 transition-colors hover:text-cb-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            className,
          )}
          aria-label="Mais informações"
        >
          <Info className={cn("h-4 w-4", iconClassName)} strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-sm border border-border/60 bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md"
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
