import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_TIPO_CONFIG } from "@/lib/chart-brand";
import type { PacienteTipo } from "@/lib/types";
import { cn } from "@/lib/utils";

type PacientesPorTipoBarChartProps = {
  data: { tipo: PacienteTipo; count: number }[];
  className?: string;
};

export function PacientesPorTipoBarChart({ data, className }: PacientesPorTipoBarChartProps) {
  const rows = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      label: CHART_TIPO_CONFIG[d.tipo].label,
      count: d.count,
      fill: CHART_TIPO_CONFIG[d.tipo].color,
    }));

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-cb-muted">Nenhum paciente ativo por tipo.</p>
    );
  }

  return (
    <ChartContainer
      config={{ count: { label: "Pacientes" } }}
      className={cn("h-[200px] w-full aspect-auto", className)}
    >
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border/60" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-[11px]"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
          className="text-[11px]"
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ChartContainer>
  );
}
