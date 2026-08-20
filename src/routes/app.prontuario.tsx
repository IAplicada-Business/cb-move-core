import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { z } from "zod";

import {
  prontuarioPatientTabSchema,
  prontuarioTabSchema,
} from "@/components/domain/prontuario/schemas";
import { assertMenuAccess } from "@/lib/route-access";

const prontuarioLayoutSearchSchema = z.object({
  pacienteId: z.string().uuid().optional(),
  tab: prontuarioTabSchema.optional(),
});

export const Route = createFileRoute("/app/prontuario")({
  validateSearch: prontuarioLayoutSearchSchema,
  beforeLoad: async ({ search }) => {
    await assertMenuAccess("app.prontuario");
    if (!search.pacienteId) return;
    if (search.tab === "visao-geral") {
      throw redirect({ to: "/app/prontuario" });
    }
    const parsedTab = search.tab
      ? prontuarioPatientTabSchema.safeParse(search.tab)
      : { success: false as const };
    throw redirect({
      to: "/app/prontuario/$pacienteId",
      params: { pacienteId: search.pacienteId },
      search: {
        tab: parsedTab.success ? parsedTab.data : "evolucao-diaria",
      },
    });
  },
  component: () => <Outlet />,
});
