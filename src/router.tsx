import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createQueryClientWithDiagnostics } from "./lib/client-diagnostics";

export const getRouter = () => {
  const queryClient = createQueryClientWithDiagnostics();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega a rota (loader + code-split chunk) ao passar o mouse/focar
    // um link, então o clique parece instantâneo em vez de esperar o
    // JS + dados carregarem só depois do clique.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
