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
    // 120ms era agressivo demais: qualquer navegação um pouco mais lenta piscava o
    // skeleton no lugar da tela. Meio segundo cobre transições instantâneas (cache
    // quente) e só mostra o pending quando o chunk realmente demora.
    defaultPendingMs: 500,
    defaultPendingMinMs: 0,
    defaultPendingComponent: RoutePending,
  });

  return router;
};
