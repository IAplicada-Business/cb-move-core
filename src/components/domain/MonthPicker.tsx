import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function monthPickerLabel(mes: number, ano: number) {
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

type MonthPickerProps = {
  mes: number;
  ano: number;
  onChange: (mes: number, ano: number) => void;
  className?: string;
};

export function MonthPicker({ mes, ano, onChange, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(ano);
  const today = new Date();
  const mesAtual = today.getMonth() + 1;
  const anoAtual = today.getFullYear();

  useEffect(() => {
    if (open) setViewYear(ano);
  }, [open, ano]);

  function selectMonth(month: number) {
    onChange(month, viewYear);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("gap-2 capitalize", className)}>
          <Calendar className="h-4 w-4" />
          {monthPickerLabel(mes, ano)}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="z-[100] w-auto p-3" align="start">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[4rem] text-center text-sm font-semibold">{viewYear}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MESES_ABREV.map((nome, index) => {
            const month = index + 1;
            const selected = mes === month && ano === viewYear;
            const isCurrent = month === mesAtual && viewYear === anoAtual;

            return (
              <button
                key={month}
                type="button"
                onClick={() => selectMonth(month)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                  !selected && isCurrent && "border border-primary/40",
                )}
              >
                {nome}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
