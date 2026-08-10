import { FilterChip, type FilterChipOption } from "@/components/domain/FilterChip";
import { competenciaOpcoes } from "@/lib/competencia";

export function CompetenciaFilterChip({
  value,
  onChange,
  extraOptions = [],
  prefix = "Competência",
}: {
  value: string;
  onChange: (value: string) => void;
  extraOptions?: FilterChipOption[];
  prefix?: string;
}) {
  return (
    <FilterChip
      prefix={prefix}
      value={value}
      options={[...extraOptions, ...competenciaOpcoes()]}
      onChange={onChange}
    />
  );
}
