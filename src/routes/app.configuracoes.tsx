import { createFileRoute, redirect } from "@tanstack/react-router";

import { ConfiguracoesLayout } from "@/components/layout/ConfiguracoesLayout";
import { assertConfigAccess } from "@/lib/route-access";

export const Route = createFileRoute("/app/configuracoes")({
  beforeLoad: async ({ location }) => {
    if (
      location.pathname === "/app/configuracoes/ajuda" ||
      location.pathname === "/app/configuracoes/creditos"
    ) {
      throw redirect({ to: "/app/configuracoes/convenios" });
    }
    await assertConfigAccess();
  },
  component: ConfiguracoesLayout,
});
