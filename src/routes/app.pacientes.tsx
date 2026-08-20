import { createFileRoute, Outlet } from "@tanstack/react-router";

import { assertMenuAccess } from "@/lib/route-access";

export const Route = createFileRoute("/app/pacientes")({
  beforeLoad: () => assertMenuAccess("app.pacientes"),
  component: () => <Outlet />,
});
