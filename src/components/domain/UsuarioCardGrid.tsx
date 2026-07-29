import { Trash2 } from "lucide-react";

import { BrandBadge } from "@/components/brand/BrandBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeRole, ROLE_LABELS, type PrimaryRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/types";
import type { UserRow } from "@/lib/queries/usuarios";

const ROLE_BADGE_TONE: Record<PrimaryRole, "info" | "success" | "neutral"> = {
  admin: "info",
  membro: "success",
  cliente: "neutral",
};

function RoleBadge({ role }: { role: AppRole | null }) {
  const primary = normalizeRole(role);
  if (!primary) return <span className="text-xs text-cb-muted">—</span>;
  return <BrandBadge tone={ROLE_BADGE_TONE[primary]}>{ROLE_LABELS[primary]}</BrandBadge>;
}

function statusLabel(user: UserRow | undefined): string {
  if (!user) return "Não cadastrado";
  return "Aguardando 1º acesso";
}

export type UsuarioCardRow = {
  key: string;
  nome: string;
  email: string;
  perfil: PrimaryRole;
  registered: UserRow | undefined;
  isReference: boolean;
};

type UsuarioCardGridProps = {
  rows: UsuarioCardRow[];
  currentUserId?: string;
  onEdit: (row: UsuarioCardRow) => void;
  onDelete: (row: UsuarioCardRow) => void;
};

export function UsuarioCardGrid({ rows, currentUserId, onEdit, onDelete }: UsuarioCardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const displayRole = (row.registered?.role ?? row.perfil) as AppRole;
        const isSelf = row.registered?.id === currentUserId;
        const cadastrado = !!row.registered;

        return (
          <article
            key={row.key}
            className={cn(
              "overflow-hidden rounded-[10px] border border-border bg-card",
              "shadow-[0_1px_2px_rgba(15,75,80,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(15,75,80,0.08)]",
              !cadastrado && "border-dashed opacity-90",
            )}
          >
            <div
              className={cn("h-[3px]", cadastrado ? "bg-cb-cyan-600" : "bg-muted-foreground/25")}
              aria-hidden
            />
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cb-cyan-050 text-sm font-bold text-cb-cyan-800 ring-1 ring-cb-cyan-100">
                    {row.nome
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? "")
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-cb-ink">{row.nome}</h3>
                    <p className="mt-0.5 truncate text-sm text-cb-muted">{row.email}</p>
                  </div>
                </div>
                <RoleBadge role={displayRole} />
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-cb-cyan-050/40 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cb-muted">
                  Status
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    cadastrado ? "text-cb-cyan-800" : "text-cb-muted",
                  )}
                >
                  {statusLabel(row.registered)}
                </span>
              </div>

              {row.isReference && (
                <p className="text-[11px] text-cb-muted">
                  Equipe de referência (doc. colaboradores)
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant={cadastrado ? "outline" : "default"}
                  className={cn(!cadastrado && "bg-cb-cyan-600 hover:bg-cb-cyan-700")}
                  onClick={() => onEdit(row)}
                >
                  {cadastrado ? "Editar" : "Cadastrar"}
                </Button>
                {cadastrado && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={isSelf}
                    title={isSelf ? "Você não pode excluir seu próprio usuário" : "Excluir usuário"}
                    onClick={() => onDelete(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
