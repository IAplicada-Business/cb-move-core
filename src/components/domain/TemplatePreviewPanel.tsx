import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  buildEmailTemplateVisualPreview,
  buildNotaFiscalVisualPreview,
  buildRelatorioVisualPreview,
  buildTemplatePreviewSections,
  wrapEmailPreviewDocument,
  type TemplatePreviewInput,
} from "@/lib/domain/template-preview";
import { MODELO_LABEL } from "@/lib/domain/templates-versionados";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Props = TemplatePreviewInput & {
  codigo: string;
  versao: number;
  modelo: string | null;
};

function TechnicalDetails({ tipo, modelo, conteudo }: TemplatePreviewInput) {
  const sections = buildTemplatePreviewSections({ tipo, modelo, conteudo });
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
        Detalhes técnicos do template
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t px-4 py-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {section.title}
            </h4>
            {section.variant === "code" ? (
              <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap break-words font-mono">
                {section.body}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">{section.body}</p>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function EmailVisualPreview({
  preview,
  modeloLabel,
}: {
  preview: NonNullable<ReturnType<typeof buildEmailTemplateVisualPreview>>;
  modeloLabel: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pré-visualização com dados fictícios · modelo {modeloLabel}
      </p>

      <div className="overflow-hidden rounded-xl border bg-[#f4f4f5] shadow-sm">
        <div className="border-b bg-white px-4 py-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">De</span>
            <span className="text-foreground">{preview.de}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">Para</span>
            <span className="text-foreground">{preview.para}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">Assunto</span>
            <span className="font-medium text-foreground">{preview.assunto}</span>
          </div>
        </div>

        <div className="bg-white mx-3 my-3 rounded-lg border shadow-inner overflow-hidden">
          {preview.isRascunho ? (
            <p className="p-6 text-sm text-amber-800 bg-amber-50">
              Corpo do e-mail ainda não configurado. Configure o template ou aplique a migration
              correspondente.
            </p>
          ) : (
            <iframe
              title="Pré-visualização do corpo do e-mail"
              sandbox=""
              srcDoc={wrapEmailPreviewDocument(preview.corpoHtml)}
              className="w-full min-h-[320px] border-0 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NotaFiscalVisualPreview({
  preview,
}: {
  preview: NonNullable<ReturnType<typeof buildNotaFiscalVisualPreview>>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Exemplo de discriminação na NFS-e</p>
      <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
        <div>
          <p className="text-xs text-muted-foreground">Tomador</p>
          <p className="text-sm font-medium">{preview.destinatarioTipo}</p>
          <p className="text-sm">{preview.destinatarioExemplo}</p>
        </div>
        {preview.campos.length > 0 && (
          <div className="rounded-lg bg-muted/30 p-3 space-y-2 text-sm">
            {preview.campos.map((c) => (
              <p key={c.label}>
                <span className="text-muted-foreground">{c.label}:</span> {c.valor}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RelatorioVisualPreview({
  preview,
}: {
  preview: NonNullable<ReturnType<typeof buildRelatorioVisualPreview>>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Campos vinculados ao relatório (layout PDF definido no sistema)
      </p>
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
        <div className="border-b pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-cb-cyan-700">CB MOVE</p>
          <h3 className="text-base font-semibold text-foreground">{preview.titulo}</h3>
        </div>
        <dl className="space-y-2 text-sm">
          {preview.campos.map((c) => (
            <div key={c.label} className="grid grid-cols-[140px_1fr] gap-2">
              <dt className="text-muted-foreground">{c.label}</dt>
              <dd className="text-foreground">{c.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function TemplatePreviewPanel({ codigo, versao, modelo, tipo, conteudo }: Props) {
  const modeloLabel = modelo ? (MODELO_LABEL[modelo] ?? modelo) : "—";
  const emailPreview =
    tipo === "email_nf" ? buildEmailTemplateVisualPreview(modelo, conteudo) : null;
  const nfPreview = tipo === "nota_fiscal" ? buildNotaFiscalVisualPreview(modelo, conteudo) : null;
  const relPreview =
    tipo === "relatorio_atendimento" ? buildRelatorioVisualPreview(modelo, conteudo) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono">{codigo}</span>
        <span className="rounded-full bg-muted px-2 py-0.5">v{versao}</span>
        {modelo && <span className="rounded-full bg-muted px-2 py-0.5">{modeloLabel}</span>}
      </div>

      {emailPreview && <EmailVisualPreview preview={emailPreview} modeloLabel={modeloLabel} />}
      {nfPreview && <NotaFiscalVisualPreview preview={nfPreview} />}
      {relPreview && <RelatorioVisualPreview preview={relPreview} />}

      {!emailPreview && !nfPreview && !relPreview && (
        <p className="text-sm text-muted-foreground">Nenhuma pré-visualização disponível.</p>
      )}

      <TechnicalDetails tipo={tipo} modelo={modelo} conteudo={conteudo} />
    </div>
  );
}
