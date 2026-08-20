import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rota legada — Ajuda passou para Configurações. */
export const Route = createFileRoute("/app/ajuda")({
  beforeLoad: () => {
    throw redirect({ to: "/app/configuracoes/ajuda" });
  },
});
