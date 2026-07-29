import type { ReactNode } from "react";
import { AppLayout } from "./AppLayout";

/** Alias do shell de produção — faixa arco-íris, user no rodapé e max-width. */
export function AppLayoutBrand({
  children,
  hideTopbar: _hideTopbar,
}: {
  children: ReactNode;
  hideTopbar?: boolean;
}) {
  return <AppLayout>{children}</AppLayout>;
}
