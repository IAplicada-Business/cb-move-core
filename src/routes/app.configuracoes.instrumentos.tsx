import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/domain/EmptyState";

export const Route = createFileRoute("/app/configuracoes/instrumentos")({
  head: () => ({ meta: [{ title: "Instrumentos clínicos · CB MOVE" }] }),
  component: () => (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Instrumentos clínicos</h1>
      </header>
      <EmptyState title="Em construção" description="Esta área será implementada nas próximas iterações." />
    </div>
  ),
});
