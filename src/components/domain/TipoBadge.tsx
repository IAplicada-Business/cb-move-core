import { cn } from "@/lib/utils";
import type { PacienteTipo } from "@/lib/types";

const MAP: Record<PacienteTipo, { label: string; cls: string }> = {
  particular: { label: "Particular", cls: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100" },
  judicial:   { label: "Judicial",   cls: "bg-[#FDF2F8] text-cb-magenta border-[#FBCFE8]" },
  convenio:   { label: "Convênio",   cls: "bg-[#F5F3FF] text-cb-purple border-[#DDD6FE]" },
  puc:        { label: "PUC",        cls: "bg-[#FFF7ED] text-cb-orange border-[#FED7AA]" },
};

export function TipoBadge({ value }: { value: PacienteTipo }) {
  const cfg = MAP[value];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  );
}
