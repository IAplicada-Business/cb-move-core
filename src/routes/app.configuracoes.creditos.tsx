import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rota legada — Créditos IA removidos das configurações. */
export const Route = createFileRoute("/app/configuracoes/creditos")({
  beforeLoad: () => {
    throw redirect({ to: "/app/configuracoes/convenios" });
  },
});
