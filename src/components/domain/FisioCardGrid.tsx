import { MoreHorizontal } from "lucide-react";

import {
  BrandTable,
  BrandTableBody,
  BrandTableCell,
  BrandTableHead,
  BrandTableHeader,
  BrandTableRow,
} from "@/components/brand/BrandTable";
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
    <BrandTable>
      <BrandTableHeader>
        <BrandTableRow>
          <BrandTableHead>Nome</BrandTableHead>
          <BrandTableHead className="hidden md:table-cell">CREFITO</BrandTableHead>
          <BrandTableHead className="hidden lg:table-cell">E-mail</BrandTableHead>
          <BrandTableHead className="w-[100px]">Ativo</BrandTableHead>
          <BrandTableHead className="w-10" />
        </BrandTableRow>
      </BrandTableHeader>
      <BrandTableBody>
        {fisios.map((f) => (
          <BrandTableRow key={f.id} className={cn(!f.ativo && "opacity-70")}>
            <BrandTableCell className="py-2.5 font-medium">
              <div className="min-w-0">
                <button
                  type="button"
                  className="truncate text-left text-cb-cyan-800 hover:underline"
                  onClick={() => onOpen(f)}
                >
                  {f.nome}
                </button>
                <p className="truncate text-xs text-cb-muted md:hidden">
                  {f.registro_profissional ? `CREFITO ${f.registro_profissional}` : "Sem registro"}
                </p>
                <p className="truncate text-xs text-cb-muted lg:hidden">
                  {f.email || "Sem e-mail cadastrado"}
                </p>
              </div>
            </BrandTableCell>
            <BrandTableCell className="hidden py-2.5 text-sm text-cb-muted md:table-cell">
              {f.registro_profissional ? `CREFITO ${f.registro_profissional}` : "—"}
            </BrandTableCell>
            <BrandTableCell className="hidden max-w-[220px] truncate py-2.5 text-sm text-cb-muted lg:table-cell">
              {f.email || "—"}
            </BrandTableCell>
            <BrandTableCell className="py-2.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={f.ativo}
                  onCheckedChange={(v) => onToggleAtivo(f.id, v)}
                  aria-label={`Ativar ${f.nome}`}
                />
                <span className="hidden text-xs text-cb-muted sm:inline">
                  {f.ativo ? "Sim" : "Não"}
                </span>
              </div>
            </BrandTableCell>
            <BrandTableCell className="py-2.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onOpen(f)}>Ver detalhes</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(f)}>Editar</DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(f)}
                  >
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </BrandTableCell>
          </BrandTableRow>
        ))}
      </BrandTableBody>
    </BrandTable>
  );
}
