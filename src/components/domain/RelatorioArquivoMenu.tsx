import { ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relatorioArquivoUrlLabel, type FormatoArquivo } from "@/lib/domain/relatorio-renderers";
import { openRelatorioArquivo } from "@/lib/relatorio-pdf-url";

type Props = {
  pdfUrl?: string | null;
  xlsxUrl?: string | null;
  formatoArquivo?: FormatoArquivo | null;
  variant?: "ghost" | "outline" | "link";
  className?: string;
  onError?: (error: Error) => void;
};

function abrir(url: string | null | undefined, onError?: (error: Error) => void) {
  void openRelatorioArquivo(url).catch((e: Error) => {
    if (onError) onError(e);
    else toast.error(e.message);
  });
}

export function RelatorioArquivoMenu({
  pdfUrl,
  xlsxUrl,
  formatoArquivo,
  variant = "ghost",
  className,
  onError,
}: Props) {
  if (!pdfUrl && !xlsxUrl) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const dual =
    formatoArquivo === "dual" || (Boolean(pdfUrl) && Boolean(xlsxUrl) && formatoArquivo !== "docx");

  if (!dual) {
    const url = xlsxUrl ?? pdfUrl;
    const label = relatorioArquivoUrlLabel(url, formatoArquivo ?? null);

    if (variant === "link") {
      return (
        <button
          type="button"
          className={`text-xs text-cb-cyan-700 hover:underline ${className ?? ""}`}
          onClick={() => abrir(url, onError)}
        >
          {label}
        </button>
      );
    }

    return (
      <Button
        variant={variant}
        size="sm"
        className={`h-8 gap-1 ${className ?? ""}`}
        onClick={() => abrir(url, onError)}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {label}
      </Button>
    );
  }

  if (variant === "link") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-0.5 text-xs text-cb-cyan-700 hover:underline ${className ?? ""}`}
          >
            Abrir
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {pdfUrl && (
            <DropdownMenuItem onClick={() => abrir(pdfUrl, onError)}>PDF</DropdownMenuItem>
          )}
          {xlsxUrl && (
            <DropdownMenuItem onClick={() => abrir(xlsxUrl, onError)}>XLSX</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className={`h-8 gap-1 ${className ?? ""}`}>
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {pdfUrl && <DropdownMenuItem onClick={() => abrir(pdfUrl, onError)}>PDF</DropdownMenuItem>}
        {xlsxUrl && (
          <DropdownMenuItem onClick={() => abrir(xlsxUrl, onError)}>XLSX</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
