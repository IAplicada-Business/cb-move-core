import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/prontuarios")({
  beforeLoad: () => {
    throw redirect({ to: "/app/prontuario", search: { tab: "visao-geral" } });
  },
});
