import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createQueryClientWithDiagnostics } from "./lib/client-diagnostics";

export const getRouter = () => {
  const queryClient = createQueryClientWithDiagnostics();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
