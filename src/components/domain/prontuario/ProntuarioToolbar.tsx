import { MonthPicker } from "@/components/domain/MonthPicker";
import { PacienteCombobox, type PacienteComboboxOption } from "@/components/domain/PacienteCombobox";

type Props = {
  pacientes: PacienteComboboxOption[];
  pacientesLoading?: boolean;
  selectedPacienteId: string | null;
  onSelectPaciente: (id: string) => void;
  competenciaMes: number;
  competenciaAno: number;
  onCompetenciaChange: (mes: number, ano: number) => void;
  showCalendar?: boolean;
};

export function ProntuarioToolbar({
  pacientes,
  pacientesLoading = false,
  selectedPacienteId,
  onSelectPaciente,
  competenciaMes,
  competenciaAno,
  onCompetenciaChange,
  showCalendar = true,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <PacienteCombobox
        pacientes={pacientes}
        value={selectedPacienteId}
        onChange={onSelectPaciente}
        loading={pacientesLoading}
        placeholder="Selecione o paciente…"
        className="flex-1 min-w-[220px] max-w-md"
      />

      {showCalendar && (
        <MonthPicker
          mes={competenciaMes}
          ano={competenciaAno}
          onChange={onCompetenciaChange}
          className="h-10 shrink-0"
        />
      )}
    </div>
  );
}
