import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute as any)("/app/ajuda")({
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Central de ajuda</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tutoriais em vídeo para usar o CB MOVE com facilidade.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {TUTORIAIS.map((t) => (
          <div key={t.num} className="rounded-xl border bg-card p-5 flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cb-cyan-050 text-cb-cyan-600 flex items-center justify-center font-bold text-sm">
              {t.num}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground leading-tight">{t.titulo}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.duracao}</p>
              {t.ytUrl ? (
                <a
                  href={t.ytUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs font-medium text-cb-cyan-600 hover:underline"
                >
                  Assistir →
                </a>
              ) : (
                <span className="inline-block mt-2 text-xs text-muted-foreground italic">
                  Em breve
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 text-sm text-amber-800">
        Dúvidas técnicas? Fale com a <strong>IAplicada Business</strong> pelo e-mail{" "}
        <a href="mailto:mariana@iaplicada.com" className="underline">
          mariana@iaplicada.com
        </a>
      </div>
    </div>
  );
}
