import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  CHART_STATUS_HEX,
  CHART_TIPO_CONFIG,
  formatChartAxisValue,
  STACK_KEYS,
} from "@/lib/chart-brand";
import { brl } from "@/lib/format";
import type { ReceitaMensalItem } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type FinanceiroHistoricoModo = "receita" | "pagamentos";

export type PagamentosHistoricoItem = {
  mes: string;
  pago: number;
  pendente: number;
};

const PAGAMENTOS_CONFIG = {
  pago: { label: "Pago", color: CHART_STATUS_HEX.pago },
  pendente: { label: "Pendente + vencido", color: CHART_STATUS_HEX.pendente },
} as const;

const LINE_CHART_CLASS =
  "flex aspect-auto h-[220px] w-full min-h-0 justify-center [&_.recharts-responsive-container]:!h-full [&_.recharts-responsive-container]:!w-full";

export function FinanceiroHistoricoModoToggle({
  modo,
  onModoChange,
  className,
}: {
  modo: FinanceiroHistoricoModo;
  onModoChange: (modo: FinanceiroHistoricoModo) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex rounded-xl border border-border/60 bg-muted/30 p-0.5", className)}
      role="tablist"
      aria-label="Visão do histórico"
    >
      <Button
        type="button"
        role="tab"
        aria-selected={modo === "receita"}
        variant={modo === "receita" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 rounded-lg px-3 text-xs"
        onClick={() => onModoChange("receita")}
      >
        Receita
      </Button>
      <Button
        type="button"
        role="tab"
        aria-selected={modo === "pagamentos"}
        variant={modo === "pagamentos" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 rounded-lg px-3 text-xs"
        onClick={() => onModoChange("pagamentos")}
      >
        Pagamentos
      </Button>
    </div>
  );
}

export function FinanceiroHistoricoLegend({
  modo,
  className,
}: {
  modo: FinanceiroHistoricoModo;
  className?: string;
}) {
  if (modo === "pagamentos") {
    return (
      <div className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
        {(Object.keys(PAGAMENTOS_CONFIG) as (keyof typeof PAGAMENTOS_CONFIG)[]).map((key) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-cb-muted">
            <i
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: PAGAMENTOS_CONFIG[key].color }}
              aria-hidden
            />
            {PAGAMENTOS_CONFIG[key].label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
      {STACK_KEYS.map((key) => (
        <span key={key} className="flex items-center gap-1.5 text-xs text-cb-muted">
          <i
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: CHART_TIPO_CONFIG[key].color }}
            aria-hidden
          />
          {CHART_TIPO_CONFIG[key].label}
        </span>
      ))}
    </div>
  );
}

type FinanceiroHistoricoChartProps = {
  modo: FinanceiroHistoricoModo;
  receitaData: ReceitaMensalItem[];
  pagamentosData: PagamentosHistoricoItem[];
  className?: string;
};

export function FinanceiroHistoricoChart({
  modo,
  receitaData,
  pagamentosData,
  className,
}: FinanceiroHistoricoChartProps) {
  if (modo === "pagamentos") {
    const hasData = pagamentosData.some((d) => d.pago > 0 || d.pendente > 0);
    if (!hasData) {
      return (
        <p className="py-10 text-center text-sm text-cb-muted">
          Sem cobranças nos últimos 6 meses.
        </p>
      );
    }

    return (
      <ChartContainer config={PAGAMENTOS_CONFIG} className={cn(LINE_CHART_CLASS, className)}>
        <LineChart data={pagamentosData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
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
                    {PAGAMENTOS_CONFIG[name as keyof typeof PAGAMENTOS_CONFIG]?.label ?? name}:{" "}
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

  const hasData = receitaData.some((row) => row.total > 0);
  if (!hasData) {
    return (
      <p className="py-10 text-center text-sm text-cb-muted">
        Sem receita registrada nos últimos 6 meses.
      </p>
    );
  }

  return (
    <ChartContainer config={CHART_TIPO_CONFIG} className={cn(LINE_CHART_CLASS, className)}>
      <LineChart data={receitaData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
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
                  {CHART_TIPO_CONFIG[name as keyof typeof CHART_TIPO_CONFIG]?.label ?? name}:{" "}
                  {brl(Number(value))}
                </span>
              )}
            />
          }
        />
        {STACK_KEYS.map((key) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/** @deprecated Use FinanceiroHistoricoLegend with modo="receita" */
export function ReceitaMensalLegend({ className }: { className?: string }) {
  return <FinanceiroHistoricoLegend modo="receita" className={className} />;
}

/** @deprecated Use FinanceiroHistoricoChart */
export function ReceitaMensalChart({
  data,
  className,
}: {
  data: ReceitaMensalItem[];
  className?: string;
}) {
  return (
    <FinanceiroHistoricoChart
      modo="receita"
      receitaData={data}
      pagamentosData={[]}
      className={className}
    />
  );
}
