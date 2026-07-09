import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterChipOption = { value: string; label: string };

export function FilterChip({
  prefix,
  value,
  options,
  onChange,
  className,
}: {
  prefix: string;
  value: string;
  options: FilterChipOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1.5",
            "text-xs font-medium text-foreground transition-colors hover:border-cb-cyan-400",
            className,
          )}
        >
          {prefix}: {current} <span className="text-muted-foreground">▾</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => onChange(opt.value)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
