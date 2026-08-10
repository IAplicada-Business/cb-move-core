import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";

import { ChartContainer } from "@/components/ui/chart";
import { CHART_STATUS_HEX, CHART_TIPO_HEX } from "@/lib/chart-brand";
import { cn } from "@/lib/utils";

type GaugeChartProps = {
  value: number;
  max?: number;
  label: string;
  sublabel?: string;
  tone?: "success" | "warning" | "danger" | "info";
  className?: string;
};

const TONE_FILL = {
  success: CHART_STATUS_HEX.pago,
  warning: CHART_STATUS_HEX.pendente,
  danger: CHART_STATUS_HEX.vencido,
  info: CHART_TIPO_HEX.particular,
} as const;

export function GaugeChart({
  value,
  max = 100,
  label,
  sublabel,
  tone = "info",
  className,
}: GaugeChartProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill = TONE_FILL[tone];
  const chartData = [{ name: "value", value: pct, fill }];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <ChartContainer
        config={{ value: { label, color: fill } }}
        className="mx-auto aspect-square h-[140px] w-full max-w-[180px]"
      >
        <RadialBarChart
          data={chartData}
          innerRadius="70%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
        >
          <RadialBar dataKey="value" background={{ fill: "hsl(var(--muted))" }} cornerRadius={4} />
          <PolarRadiusAxis tick={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) - 4}
                        className="fill-foreground text-2xl font-bold"
                      >
                        {pct}%
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 14}
                        className="fill-muted-foreground text-[10px]"
                      >
                        {label}
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
      {sublabel && <p className="mt-1 text-center text-xs text-cb-muted">{sublabel}</p>}
    </div>
  );
}
