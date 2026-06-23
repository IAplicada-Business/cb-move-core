import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/domain/EmptyState";

export const Route = createFileRoute("/app/fisios")({
  head: () => ({ meta: [{ title: "Fisioterapeutas · CB MOVE" }] }),
  component: () => (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Fisioterapeutas</h1>
      </header>
      <EmptyState title="Em construção" description="Esta área será implementada nas próximas iterações." />
    </div>
  ),
});
