import { MoreHorizontal } from "lucide-react";

import { initials } from "@/lib/format";
import type { Fisio } from "@/lib/queries/fisioterapeutas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

type FisioCardGridProps = {
  fisios: Fisio[];
  onOpen: (fisio: Fisio) => void;
  onEdit: (fisio: Fisio) => void;
  onDelete: (fisio: Fisio) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
};

export function FisioCardGrid({
  fisios,
  onOpen,
  onEdit,
  onDelete,
  onToggleAtivo,
}: FisioCardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {fisios.map((f) => (
        <article
          key={f.id}
          className={cn(
            "group relative overflow-hidden rounded-[10px] border border-border bg-card",
            "shadow-[0_1px_2px_rgba(15,75,80,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(15,75,80,0.08)]",
            !f.ativo && "opacity-75",
          )}
        >
          <div
            className={cn("h-[3px]", f.ativo ? "bg-cb-cyan-600" : "bg-muted-foreground/30")}
            aria-hidden
          />
          <button
            type="button"
            className="flex w-full flex-col items-start gap-4 p-5 text-left"
            onClick={() => onOpen(f)}
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cb-cyan-600 text-sm font-bold text-white">
                  {initials(f.nome)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-cb-ink">{f.nome}</h3>
                  <p className="mt-0.5 text-xs text-cb-muted">
                    {f.registro_profissional
                      ? `CREFITO ${f.registro_profissional}`
                      : "Sem registro"}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(f);
                    }}
                  >
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(f);
                    }}
                  >
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="truncate text-sm text-cb-muted">{f.email || "Sem e-mail cadastrado"}</p>
          </button>

          <div
            className="flex items-center justify-between border-t border-border px-5 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs font-medium text-cb-muted">
              {f.ativo ? "Ativo na equipe" : "Inativo"}
            </span>
            <Switch
              checked={f.ativo}
              onCheckedChange={(v) => onToggleAtivo(f.id, v)}
              aria-label={`Ativar ${f.nome}`}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
