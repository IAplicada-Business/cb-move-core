import type { ReactNode } from "react";
import { AppLayout } from "./AppLayout";

/** Alias do shell de produção — faixa arco-íris, tema no rodapé da sidebar e perfil no topbar. */
export function AppLayoutBrand({
  children,
  hideTopbar: _hideTopbar,
}: {
  children: ReactNode;
  hideTopbar?: boolean;
}) {
  return <AppLayout>{children}</AppLayout>;
}
