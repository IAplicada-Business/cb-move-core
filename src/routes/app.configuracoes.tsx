import { createFileRoute, Outlet } from "@tanstack/react-router";

import { assertConfigAccess, assertMenuAccess } from "@/lib/route-access";

export const Route = createFileRoute("/app/configuracoes")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/app/configuracoes/ajuda") {
      await assertMenuAccess("cfg.ajuda");
      return;
    }
    await assertConfigAccess();
  },
  component: () => <Outlet />,
});
