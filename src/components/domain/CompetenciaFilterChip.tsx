import { FilterChip, type FilterChipOption } from "@/components/domain/FilterChip";
import { competenciaOpcoes } from "@/lib/competencia";

export function CompetenciaFilterChip({
  value,
  onChange,
  extraOptions = [],
  prefix = "Competência",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  extraOptions?: FilterChipOption[];
  prefix?: string;
  className?: string;
}) {
  return (
    <FilterChip
      prefix={prefix}
      value={value}
      options={[...extraOptions, ...competenciaOpcoes()]}
      onChange={onChange}
      className={className}
    />
  );
}
