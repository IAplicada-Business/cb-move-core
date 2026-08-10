import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_TIPO_HEX } from "@/lib/chart-brand";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

type TopConveniosBarChartProps = {
  rows: { convenio: string; faturado: number }[];
  className?: string;
};

export function TopConveniosBarChart({ rows, className }: TopConveniosBarChartProps) {
  const data = [...rows]
    .sort((a, b) => b.faturado - a.faturado)
    .slice(0, 6)
    .map((r) => ({ label: r.convenio, faturado: r.faturado, fill: CHART_TIPO_HEX.particular }));

  if (data.length === 0) {
    return (
      <p className={cn("text-center text-sm text-cb-muted", className)}>
        Sem faturamento por convênio.
      </p>
    );
  }

  return (
    <ChartContainer
      config={{ faturado: { label: "Faturado", color: CHART_TIPO_HEX.particular } }}
      className={cn("aspect-auto w-full min-h-0", className ?? "h-[200px]")}
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border/60" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-[10px]"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => brl(v)}
          className="text-[10px]"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => <span className="tabular-nums">{brl(Number(value))}</span>}
            />
          }
        />
        <Bar dataKey="faturado" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ChartContainer>
  );
}
