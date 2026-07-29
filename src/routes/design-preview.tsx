import { createFileRoute, redirect } from "@tanstack/react-router";
import { DollarSign, Plus, Search } from "lucide-react";

import { AppLayoutBrand } from "@/components/layout/AppLayoutBrand";
import {
  BrandBadge,
  BrandBadgeTipo,
  BrandKpiCard,
  BrandTable,
  BrandTableBody,
  BrandTableCell,
  BrandTableHead,
  BrandTableHeader,
  BrandTableNumCell,
  BrandTableRow,
  BrandTableShell,
  DataToolbar,
  DataToolbarSearch,
  PageHeader,
} from "@/components/brand";
import { FilterChip } from "@/components/domain/FilterChip";
import { DashboardSectionBadge } from "@/components/domain/DashboardSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/design-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw redirect({ to: "/app" });
    }
  },
  head: () => ({
    meta: [{ title: "[DEV] Design Preview · CB MOVE" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: DesignPreviewPage,
});

function DesignPreviewPage() {
  return (
    <AppLayoutBrand>
      <div className="space-y-8">
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Preview local (dev only).</strong> Componentes de marca para comparação com o
          mockup — o shell e as rotas de produção já usam o design system CBmove.
        </div>

        <PageHeader
          crumbs={[{ label: "Financeiro", to: "/app/cobrancas" }, { label: "Cobranças" }]}
          title="Cobranças"
          description="Gestão de faturamento — composição alinhada ao mockup"
          actions={
            <Button size="sm" className="bg-cb-cyan-600 hover:bg-cb-cyan-700">
              <Plus className="h-4 w-4" />
              Nova cobrança
            </Button>
          }
        />

        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <BrandKpiCard
            label="Total do mês"
            value="R$ 84.320"
            accent="cyan"
            icon={<DollarSign className="h-4 w-4 text-cb-cyan-600" />}
            delta={{ text: "↑ 12,4% vs maio", tone: "up" }}
          />
          <BrandKpiCard
            label="Pago"
            value="R$ 53.130"
            accent="lime"
            delta={{ text: "63% do total", tone: "neutral" }}
          />
          <BrandKpiCard
            label="Pendente"
            value="R$ 26.330"
            accent="orange"
            delta={{ text: "7 cobranças", tone: "neutral" }}
          />
          <BrandKpiCard
            label="Vencido"
            value="R$ 4.860"
            accent="magenta"
            delta={{ text: "↑ 2 casos novos", tone: "down" }}
          />
        </div>

        <DataToolbar>
          <DataToolbarSearch>
            <Search className="h-4 w-4 shrink-0" />
            <Input
              placeholder="Buscar por paciente…"
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </DataToolbarSearch>
          <FilterChip
            prefix="Competência"
            value="2026-06"
            options={[
              { value: "2026-06", label: "Jun/2026" },
              { value: "2026-05", label: "Mai/2026" },
            ]}
            onChange={() => undefined}
          />
          <FilterChip
            prefix="Status"
            value="todos"
            options={[
              { value: "todos", label: "Todos" },
              { value: "pendente", label: "Pendente" },
            ]}
            onChange={() => undefined}
          />
        </DataToolbar>

        <BrandTableShell
          eyebrow="Financeiro"
          accent="cyan"
          title="Últimas cobranças"
          badge={<DashboardSectionBadge accent="cyan">Jun/2026</DashboardSectionBadge>}
        >
          <BrandTable>
            <BrandTableHeader>
              <BrandTableRow>
                <BrandTableHead>Paciente</BrandTableHead>
                <BrandTableHead>Tipo</BrandTableHead>
                <BrandTableHead>Competência</BrandTableHead>
                <BrandTableHead>Status</BrandTableHead>
                <BrandTableHead className="text-right">Valor</BrandTableHead>
              </BrandTableRow>
            </BrandTableHeader>
            <BrandTableBody>
              {[
                {
                  nome: "Susana Vaz",
                  tipo: "judicial" as const,
                  comp: "Jun/2026",
                  status: "Aguard. alvará",
                  valor: "R$ 2.128,00",
                },
                {
                  nome: "Arturo Tavares",
                  tipo: "convenio" as const,
                  comp: "Jun/2026",
                  status: "Pago",
                  valor: "R$ 1.480,00",
                },
                {
                  nome: "Paulo R. Júnior",
                  tipo: "particular" as const,
                  comp: "Jun/2026",
                  status: "Pendente",
                  valor: "R$ 980,00",
                },
              ].map((row) => (
                <BrandTableRow key={row.nome}>
                  <BrandTableCell className="font-medium">{row.nome}</BrandTableCell>
                  <BrandTableCell>
                    <BrandBadgeTipo value={row.tipo} />
                  </BrandTableCell>
                  <BrandTableCell>{row.comp}</BrandTableCell>
                  <BrandTableCell>
                    <BrandBadge tone={row.status === "Pago" ? "success" : "info"}>
                      {row.status}
                    </BrandBadge>
                  </BrandTableCell>
                  <BrandTableNumCell>{row.valor}</BrandTableNumCell>
                </BrandTableRow>
              ))}
            </BrandTableBody>
          </BrandTable>
        </BrandTableShell>
      </div>
    </AppLayoutBrand>
  );
}
