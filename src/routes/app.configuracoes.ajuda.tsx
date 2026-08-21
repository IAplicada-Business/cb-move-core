import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rota legada — Central de ajuda removida das configurações. */
export const Route = createFileRoute("/app/configuracoes/ajuda")({
  beforeLoad: () => {
    throw redirect({ to: "/app/configuracoes/convenios" });
  },
});
