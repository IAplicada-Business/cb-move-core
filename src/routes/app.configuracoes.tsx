import { createFileRoute, Outlet } from "@tanstack/react-router";

import { assertConfigAccess } from "@/lib/route-access";

export const Route = createFileRoute("/app/configuracoes")({
  beforeLoad: () => assertConfigAccess(),
  component: () => <Outlet />,
});
