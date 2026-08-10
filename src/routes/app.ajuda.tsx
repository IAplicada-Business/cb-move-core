import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/brand/PageHeader";
import { DashboardPage } from "@/components/domain/DashboardSection";

export const Route = createFileRoute("/app/ajuda")({
  head: () => ({ meta: [{ title: "Ajuda · CB MOVE" }] }),
  component: AjudaPage,
});

const TUTORIAIS = [
  { num: "01", titulo: "Login e cadastro de paciente", duracao: "3 min", ytUrl: "" },
  { num: "02", titulo: "Marcar frequência", duracao: "2 min", ytUrl: "" },
  { num: "03", titulo: "Emitir nota fiscal", duracao: "4 min", ytUrl: "" },
  { num: "04", titulo: "Gerar relatório mensal", duracao: "3 min", ytUrl: "" },
  { num: "05", titulo: "Transcrever evolução por áudio", duracao: "5 min", ytUrl: "" },
  { num: "06", titulo: "Portal do paciente — visão geral", duracao: "3 min", ytUrl: "" },
];

function AjudaPage() {
  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Ajuda" }]}
        title="Central de ajuda"
        description="Tutoriais em vídeo para usar o CB MOVE com facilidade."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {TUTORIAIS.map((t) => (
          <div key={t.num} className="flex gap-4 rounded-xl border bg-card p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cb-cyan-050 text-sm font-bold text-cb-cyan-600">
              {t.num}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight text-foreground">{t.titulo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.duracao}</p>
              {t.ytUrl ? (
                <a
                  href={t.ytUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-cb-cyan-600 hover:underline"
                >
                  Assistir →
                </a>
              ) : (
                <span className="mt-2 inline-block text-xs italic text-muted-foreground">
                  Em breve
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Dúvidas técnicas? Fale com a <strong>IAplicada Business</strong> pelo e-mail{" "}
        <a href="mailto:mariana@iaplicada.com" className="underline">
          mariana@iaplicada.com
        </a>
      </div>
    </DashboardPage>
  );
}
