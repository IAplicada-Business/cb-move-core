import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_STATUS_HEX, CHART_TIPO_HEX, formatChartAxisValue } from "@/lib/chart-brand";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

type DivergenciaTrendLineChartProps = {
  data: { semana: string; agendas: number; divergencias: number }[];
  className?: string;
};

const CONFIG = {
  agendas: { label: "Realizadas", color: CHART_TIPO_HEX.particular },
  divergencias: { label: "Divergências", color: CHART_STATUS_HEX.vencido },
};

export function DivergenciaTrendLineChart({ data, className }: DivergenciaTrendLineChartProps) {
  const hasData = data.some((d) => d.agendas > 0 || d.divergencias > 0);
  if (!hasData) {
    return (
      <p className="py-10 text-center text-sm text-cb-muted">Sem histórico nas últimas semanas.</p>
    );
  }

  return (
    <ChartContainer config={CONFIG} className={cn("h-[200px] w-full aspect-auto", className)}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border/60" />
        <XAxis
          dataKey="semana"
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
        <Line
          type="monotone"
          dataKey="agendas"
          stroke="var(--color-agendas)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="divergencias"
          stroke="var(--color-divergencias)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

type CobrancaTrendLineChartProps = {
  data: { mes: string; pago: number; pendente: number }[];
  className?: string;
};

const COBRANCA_CONFIG = {
  pago: { label: "Pago", color: CHART_STATUS_HEX.pago },
  pendente: { label: "Pendente + vencido", color: CHART_STATUS_HEX.pendente },
};

export function CobrancaTrendLineChart({ data, className }: CobrancaTrendLineChartProps) {
  const hasData = data.some((d) => d.pago > 0 || d.pendente > 0);
  if (!hasData) {
    return (
      <p className={cn("text-center text-sm text-cb-muted", className)}>
        Sem cobranças nos últimos meses.
      </p>
    );
  }

  return (
    <ChartContainer
      config={COBRANCA_CONFIG}
      className={cn("aspect-auto w-full min-h-0", className ?? "h-[220px]")}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border/60" />
        <XAxis
          dataKey="mes"
          interval={0}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={0}
          className="text-[10px] font-medium uppercase tracking-wide"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(value) => formatChartAxisValue(Number(value))}
          className="text-[10px]"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => String(label)}
              formatter={(value, name) => (
                <span className="tabular-nums">
                  {COBRANCA_CONFIG[name as keyof typeof COBRANCA_CONFIG]?.label ?? name}:{" "}
                  {brl(Number(value))}
                </span>
              )}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="pago"
          stroke="var(--color-pago)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="pendente"
          stroke="var(--color-pendente)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
