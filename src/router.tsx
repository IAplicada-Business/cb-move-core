import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createQueryClientWithDiagnostics } from "./lib/client-diagnostics";
import { RoutePending } from "./components/layout/RoutePending";

export const getRouter = () => {
  const queryClient = createQueryClientWithDiagnostics();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 60_000,
    // Padrão do TanStack é 1000ms — deixa a tela “congelada” antes de reagir.
    defaultPendingMs: 120,
    defaultPendingMinMs: 0,
    defaultPendingComponent: RoutePending,
  });

  return router;
};
