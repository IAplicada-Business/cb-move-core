import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
};

export function AgendaMenuSection({
  title,
  subtitle,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className,
}: Props) {
  return (
    <Collapsible
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className={cn("group rounded-lg border bg-muted/10", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</p>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 pb-3 pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
