import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, FilePlus2, Sparkles, Wrench } from "lucide-react";

import { PageHeader } from "@/components/brand/PageHeader";
import { DashboardPage, DashboardSection } from "@/components/domain/DashboardSection";
import { assertMenuAccess } from "@/lib/route-access";

export const Route = createFileRoute("/app/configuracoes/")({
  head: () => ({ meta: [{ title: "Configurações · CB MOVE" }] }),
  beforeLoad: () => assertMenuAccess("cfg.geral"),
  component: ConfiguracoesPage,
});

const CARDS = [
  {
    href: "/app/configuracoes/convenios",
    title: "Convênios",
    description: "Gerencie os convênios e planos de saúde ativos.",
    icon: Building2,
    accent: "bg-cb-cyan-600",
  },
  {
    href: "/app/configuracoes/templates",
    title: "Templates",
    description:
      "Modelos versionados de NF, e-mail e relatórios (RQ.GPS.*). Layout de PDF definido no código.",
    icon: FilePlus2,
    accent: "bg-cb-purple",
  },
  {
    href: "/app/configuracoes/instrumentos",
    title: "Instrumentos",
    description: "Catálogo de instrumentos de avaliação neurológica.",
    icon: Wrench,
    accent: "bg-cb-lime",
  },
  {
    href: "/app/configuracoes/creditos",
    title: "Créditos IA",
    description: "Consumo de tokens Anthropic Claude (admin).",
    icon: Sparkles,
    accent: "bg-cb-orange",
  },
] as const;

function ConfiguracoesPage() {
  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Sistema" }, { label: "Configurações" }]}
        title="Configurações"
        description="Gerencie cadastros base, templates e parâmetros do CB MOVE."
      />

      <DashboardSection
        eyebrow="Sistema"
        accent="purple"
        title="Módulos"
        description="Escolha uma área para configurar"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                to={card.href}
                className="cb-glass-card cb-hover-lift group overflow-hidden"
              >
                <div className={cnStrip(card.accent)} aria-hidden />
                <div className="flex gap-4 p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cb-cyan-050 text-cb-cyan-700 ring-1 ring-cb-cyan-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-cb-ink transition-colors group-hover:text-cb-cyan-700">
                      {card.title}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-cb-muted">{card.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </DashboardSection>
    </DashboardPage>
  );
}

function cnStrip(accent: string) {
  return `h-[3px] ${accent}`;
}
