import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type PacienteComboboxOption = { id: string; nome: string };

type Props = {
  pacientes: PacienteComboboxOption[];
  value: string | null;
  onChange: (id: string) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
};

export function PacienteCombobox({
  pacientes,
  value,
  onChange,
  loading = false,
  placeholder = "Selecione o paciente…",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selected = pacientes.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pacientes;
    return pacientes.filter((p) => p.nome.toLowerCase().includes(q));
  }, [pacientes, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-10 justify-between bg-background font-normal", className)}
        >
          <span className="truncate text-left">
            {loading && !selected ? "Carregando pacientes…" : (selected?.nome ?? placeholder)}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
        align="start"
      >
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            className="h-10 border-0 shadow-none focus-visible:ring-0"
            placeholder="Buscar na lista…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ScrollArea className="max-h-64">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando pacientes…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
          ) : (
            <div className="p-1">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent",
                    value === p.id && "bg-accent",
                  )}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 text-primary",
                      value === p.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate text-left">{p.nome}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
