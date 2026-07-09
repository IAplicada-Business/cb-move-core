import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HORA_MIN = 8;
const HORA_MAX = 20;
const MINUTOS = [0, 15, 30, 45] as const;

function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = HORA_MIN; h <= HORA_MAX; h++) {
    for (const m of MINUTOS) {
      if (h === HORA_MAX && m > 0) break;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

function isValidHHMM(value: string) {
  const m = value.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

type TimeInputHHMMProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function TimeInputHHMM({
  value,
  onChange,
  onBlur,
  id,
  placeholder = "HH:mm",
  disabled,
}: TimeInputHHMMProps) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const valid = useMemo(() => isValidHHMM(value), [value]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({ block: "center" });
    });
  }, [open, value]);

  function selectTime(time: string) {
    onChange(time);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onClick={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          inputMode="numeric"
          disabled={disabled}
          className="pr-9"
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 top-0 h-full w-9 rounded-l-none text-muted-foreground hover:text-foreground"
            aria-label="Abrir seletor de hora"
          >
            <Clock className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
      </div>

      <PopoverContent className="z-[100] w-36 p-2" align="start">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Horário (24h)</p>
        <div ref={listRef} className="max-h-52 overflow-y-auto">
          <div className="grid grid-cols-1 gap-0.5">
            {TIME_SLOTS.map((time) => {
              const selected = valid && value === time;
              return (
                <button
                  key={time}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  onClick={() => selectTime(time)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-left text-sm tabular-nums transition-colors hover:bg-accent",
                    selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
