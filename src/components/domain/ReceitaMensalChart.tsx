import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_TIPO_CONFIG, formatChartAxisValue, STACK_KEYS } from "@/lib/chart-brand";
import { brl } from "@/lib/format";
import type { ReceitaMensalItem } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

const CHART_CONFIG = CHART_TIPO_CONFIG;

export function ReceitaMensalLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
      {STACK_KEYS.map((key) => (
        <span key={key} className="flex items-center gap-1.5 text-xs text-cb-muted">
          <i
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: CHART_CONFIG[key].color }}
            aria-hidden
          />
          {CHART_CONFIG[key].label}
        </span>
      ))}
    </div>
  );
}

type ReceitaMensalChartProps = {
  data: ReceitaMensalItem[];
  className?: string;
};

export function ReceitaMensalChart({ data, className }: ReceitaMensalChartProps) {
  const hasData = data.some((row) => row.total > 0);

  if (!hasData) {
    return (
      <p className="py-10 text-center text-sm text-cb-muted">
        Sem receita registrada nos últimos 6 meses.
      </p>
    );
  }

  return (
    <ChartContainer
      config={CHART_CONFIG}
      className={cn(
        "flex aspect-auto h-[260px] w-full min-h-0 justify-center [&_.recharts-responsive-container]:!h-full [&_.recharts-responsive-container]:!w-full",
        className,
      )}
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border/60" />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          className="text-[11px] font-semibold uppercase tracking-wide"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatChartAxisValue(value, { withCurrencyPrefix: true })}
          width={56}
          className="text-[11px]"
        />
        <ChartTooltip
          cursor={{ fill: "rgba(63, 181, 188, 0.08)" }}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="tabular-nums">
                  {CHART_CONFIG[name as keyof typeof CHART_CONFIG]?.label ?? name}:{" "}
                  {brl(Number(value))}
                </span>
              )}
            />
          }
        />
        {STACK_KEYS.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="receita"
            fill={`var(--color-${key})`}
            radius={key === "particular" ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={32}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
