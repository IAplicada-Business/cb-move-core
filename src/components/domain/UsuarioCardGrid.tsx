import { Pencil, Trash2 } from "lucide-react";

import { BrandBadge } from "@/components/brand/BrandBadge";
import {
  BrandTable,
  BrandTableBody,
  BrandTableCell,
  BrandTableHead,
  BrandTableHeader,
  BrandTableRow,
} from "@/components/brand/BrandTable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PrimaryRole } from "@/lib/permissions";
import { formatLastSignIn } from "@/lib/format";
import type { UserRow } from "@/lib/queries/usuarios";
import { usuarioStatusLabel } from "@/lib/usuario-status";
import { resolveUsuarioDisplayBadge } from "@/lib/usuario-equipe";

function EquipeBadge({ row }: { row: UsuarioCardRow }) {
  const badge = resolveUsuarioDisplayBadge(row);
  return <BrandBadge tone={badge.tone}>{badge.label}</BrandBadge>;
}

export type UsuarioCardRow = {
  key: string;
  nome: string;
  email: string;
  perfil: PrimaryRole | "fisio" | "cliente";
  registered: UserRow | undefined;
  isReference: boolean;
  tipoEquipeReferencia?: "fisio" | "secretaria";
  observacaoReferencia?: string;
};

type UsuarioCardGridProps = {
  rows: UsuarioCardRow[];
  currentUserId?: string;
  onEdit: (row: UsuarioCardRow) => void;
  onDelete: (row: UsuarioCardRow) => void;
};

export function UsuarioCardGrid({ rows, currentUserId, onEdit, onDelete }: UsuarioCardGridProps) {
  return (
    <BrandTable className="min-w-[760px]">
      <BrandTableHeader>
        <BrandTableRow>
          <BrandTableHead>Nome</BrandTableHead>
          <BrandTableHead className="hidden sm:table-cell">E-mail</BrandTableHead>
          <BrandTableHead className="w-[130px]">Perfil</BrandTableHead>
          <BrandTableHead className="hidden md:table-cell w-[120px]">Último login</BrandTableHead>
          <BrandTableHead className="w-[150px]">Status</BrandTableHead>
          <BrandTableHead className="min-w-[120px] text-right">Ações</BrandTableHead>
        </BrandTableRow>
      </BrandTableHeader>
      <BrandTableBody>
        {rows.map((row) => {
          const isSelf = row.registered?.id === currentUserId;
          const cadastrado = !!row.registered;

          return (
            <BrandTableRow key={row.key} className={cn(!cadastrado && "bg-muted/20")}>
              <BrandTableCell className="py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-cb-ink">{row.nome}</p>
                  <p className="truncate text-xs text-cb-muted sm:hidden">{row.email}</p>
                </div>
              </BrandTableCell>
              <BrandTableCell className="hidden max-w-[240px] truncate py-2.5 text-sm text-cb-muted sm:table-cell">
                {row.email}
              </BrandTableCell>
              <BrandTableCell className="py-2.5">
                <EquipeBadge row={row} />
              </BrandTableCell>
              <BrandTableCell className="hidden py-2.5 text-xs text-cb-muted md:table-cell">
                {formatLastSignIn(row.registered?.last_sign_in_at)}
              </BrandTableCell>
              <BrandTableCell className="py-2.5 text-xs text-cb-muted">
                {usuarioStatusLabel(row.registered)}
              </BrandTableCell>
              <BrandTableCell className="py-2.5">
                <div className="flex items-center justify-end gap-1">
                  {cadastrado ? (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Editar ${row.nome}`}
                        onClick={() => onEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={isSelf}
                        aria-label={
                          isSelf
                            ? "Você não pode excluir seu próprio usuário"
                            : `Excluir ${row.nome}`
                        }
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 bg-cb-cyan-600 px-3 hover:bg-cb-cyan-700"
                      onClick={() => onEdit(row)}
                    >
                      Cadastrar
                    </Button>
                  )}
                </div>
              </BrandTableCell>
            </BrandTableRow>
          );
        })}
      </BrandTableBody>
    </BrandTable>
  );
}
