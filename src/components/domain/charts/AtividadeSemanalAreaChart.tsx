import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_TIPO_HEX } from "@/lib/chart-brand";
import { cn } from "@/lib/utils";

type AtividadeSemanalAreaChartProps = {
  data: { dia: string; sessoes: number }[];
  className?: string;
};

export function AtividadeSemanalAreaChart({ data, className }: AtividadeSemanalAreaChartProps) {
  const hasData = data.some((d) => d.sessoes > 0);
  if (!hasData) {
    return (
      <p className="py-10 text-center text-sm text-cb-muted">
        Sem sessões realizadas nos últimos 7 dias.
      </p>
    );
  }

  const config = { sessoes: { label: "Sessões", color: CHART_TIPO_HEX.particular } };

  return (
    <ChartContainer config={config} className={cn("h-[220px] w-full aspect-auto", className)}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fillSessoes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_TIPO_HEX.particular} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_TIPO_HEX.particular} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border/60" />
        <XAxis
          dataKey="dia"
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
        <Area
          type="monotone"
          dataKey="sessoes"
          stroke={CHART_TIPO_HEX.particular}
          fill="url(#fillSessoes)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
