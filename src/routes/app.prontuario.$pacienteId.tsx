import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { ProntuarioPacienteView } from "@/components/domain/prontuario/ProntuarioPacienteView";
import {
  prontuarioPatientTabSchema,
  resolvePatientTab,
  type ProntuarioPatientTab,
} from "@/components/domain/prontuario/schemas";

const prontuarioPacienteSearchSchema = z.object({
  tab: prontuarioPatientTabSchema.optional(),
});

export const Route = createFileRoute("/app/prontuario/$pacienteId")({
  head: () => ({ meta: [{ title: "Prontuário · CB MOVE" }] }),
  params: {
    parse: (params) => ({
      pacienteId: z.string().uuid().parse(params.pacienteId),
    }),
    stringify: (params) => ({ pacienteId: params.pacienteId }),
  },
  validateSearch: prontuarioPacienteSearchSchema,
  component: ProntuarioPacienteRoute,
});

function ProntuarioPacienteRoute() {
  const { pacienteId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = resolvePatientTab(tab);

  function navigatePatient(next: { pacienteId?: string; tab?: ProntuarioPatientTab }) {
    navigate({
      to: "/app/prontuario/$pacienteId",
      params: { pacienteId: next.pacienteId ?? pacienteId },
      search: { tab: next.tab ?? activeTab },
    });
  }

  return (
    <ProntuarioPacienteView
      pacienteId={pacienteId}
      activeTab={activeTab}
      onTabChange={(nextTab) => {
        if (nextTab === "visao-geral") {
          navigate({ to: "/app/prontuario" });
          return;
        }
        navigatePatient({ tab: nextTab });
      }}
      onSelectPaciente={(id, nextTab) => navigatePatient({ pacienteId: id, tab: nextTab })}
    />
  );
}
