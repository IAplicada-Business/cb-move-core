import { Input } from "@/components/ui/input";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  DIAS_SEMANA_EXEMPLOS,
  FREQUENCIA_ATENDIMENTO_EXEMPLOS,
} from "@/lib/domain/atendimento-cadastro";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";

type Props<T extends FieldValues> = {
  field: ControllerRenderProps<T, Path<T>>;
  label: string;
  exemplos: readonly string[];
  listId: string;
  placeholder: string;
};

function CampoComSugestoes<T extends FieldValues>({
  field,
  label,
  exemplos,
  listId,
  placeholder,
}: Props<T>) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <>
          <Input {...field} value={field.value ?? ""} list={listId} placeholder={placeholder} />
          <datalist id={listId}>
            {exemplos.map((ex) => (
              <option key={ex} value={ex} />
            ))}
          </datalist>
        </>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}

export function CampoFrequenciaAtendimento<T extends FieldValues>({
  field,
}: {
  field: ControllerRenderProps<T, Path<T>>;
}) {
  return (
    <CampoComSugestoes
      field={field}
      label="Frequência"
      exemplos={FREQUENCIA_ATENDIMENTO_EXEMPLOS}
      listId="frequencia-atendimento-exemplos"
      placeholder="Ex.: 2x semana triplo"
    />
  );
}

export function CampoDiasSemana<T extends FieldValues>({
  field,
}: {
  field: ControllerRenderProps<T, Path<T>>;
}) {
  return (
    <CampoComSugestoes
      field={field}
      label="Dias da semana"
      exemplos={DIAS_SEMANA_EXEMPLOS}
      listId="dias-semana-exemplos"
      placeholder="Ex.: 2ª e 5ª (triplos)"
    />
  );
}
