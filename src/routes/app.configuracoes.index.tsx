import { createFileRoute, redirect } from "@tanstack/react-router";

import { assertMenuAccess } from "@/lib/route-access";

export const Route = createFileRoute("/app/configuracoes/")({
  beforeLoad: () => {
    assertMenuAccess("cfg.geral");
    throw redirect({ to: "/app/configuracoes/convenios" });
  },
});
