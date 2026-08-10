import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_STATUS_HEX } from "@/lib/chart-brand";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

type RecebimentoGaugeChartProps = {
  recebido: number;
  faturado: number;
  className?: string;
};

export function RecebimentoGaugeChart({
  recebido,
  faturado,
  className,
}: RecebimentoGaugeChartProps) {
  if (faturado <= 0) {
    return (
      <p className={cn("text-center text-sm text-cb-muted", className)}>
        Sem faturamento na competência.
      </p>
    );
  }

  const pct = Math.min(100, Math.round((recebido / faturado) * 100));
  const data = [
    { name: "Recebido", value: recebido, fill: CHART_STATUS_HEX.recebido },
    { name: "Em aberto", value: Math.max(0, faturado - recebido), fill: CHART_STATUS_HEX.emAberto },
  ];

  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1", className)}>
      <ChartContainer
        config={{
          recebido: { label: "Recebido", color: CHART_STATUS_HEX.recebido },
          emAberto: { label: "Em aberto", color: CHART_STATUS_HEX.emAberto },
        }}
        className="aspect-square h-[132px] w-full max-w-[148px] min-h-0"
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => <span className="tabular-nums">{brl(Number(value))}</span>}
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="80%"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <p className="text-xl font-bold tabular-nums leading-none text-cb-ink">{pct}%</p>
      <p className="text-[11px] text-cb-muted">do faturado recebido</p>
    </div>
  );
}

type RecebimentoPorConvenioPieProps = {
  rows: { convenio: string; recebido: number }[];
  className?: string;
};

const PIE_COLORS = ["#3FB5BC", "#7B4FB5", "#D946A0", "#F58A1F", "#C5D932", "#2D8388"];

export function RecebimentoPorConvenioPie({ rows, className }: RecebimentoPorConvenioPieProps) {
  const data = rows.filter((r) => r.recebido > 0).slice(0, 6);
  if (data.length === 0) {
    return (
      <p className={cn("text-center text-sm text-cb-muted", className)}>
        Sem recebimentos por convênio.
      </p>
    );
  }

  const chartRows = data.map((r, i) => ({
    name: r.convenio,
    value: r.recebido,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <ChartContainer
      config={{ value: { label: "Recebido" } }}
      className={cn("aspect-auto w-full min-h-0", className ?? "h-[200px]")}
    >
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => <span className="tabular-nums">{brl(Number(value))}</span>}
            />
          }
        />
        <Pie data={chartRows} dataKey="value" nameKey="name" innerRadius={0} outerRadius="80%">
          {chartRows.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
