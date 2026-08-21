import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rota legada — Ajuda removida das configurações. */
export const Route = createFileRoute("/app/ajuda")({
  beforeLoad: () => {
    throw redirect({ to: "/app/configuracoes/convenios" });
  },
});
