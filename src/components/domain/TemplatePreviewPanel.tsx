import {
  buildTemplatePreviewSections,
  type TemplatePreviewInput,
} from "@/lib/domain/template-preview";

type Props = TemplatePreviewInput & {
  codigo: string;
  versao: number;
  modelo: string | null;
};

export function TemplatePreviewPanel({ codigo, versao, modelo, tipo, conteudo }: Props) {
  const sections = buildTemplatePreviewSections({ tipo, modelo, conteudo });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono">{codigo}</span>
        <span className="rounded-full bg-muted px-2 py-0.5">v{versao}</span>
        {modelo && <span className="rounded-full bg-muted px-2 py-0.5">{modelo}</span>}
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-1.5">
          <h4 className="text-sm font-medium text-foreground">{section.title}</h4>
          {section.variant === "code" ? (
            <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words font-mono">
              {section.body}
            </pre>
          ) : (
            <p
              className={`text-sm rounded-lg p-3 ${
                section.variant === "warning"
                  ? "border border-amber-200 bg-amber-50 text-amber-900"
                  : section.variant === "muted"
                    ? "bg-muted/40 text-muted-foreground"
                    : "border bg-card text-foreground"
              }`}
            >
              {section.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
