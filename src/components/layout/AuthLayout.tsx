import type { ReactNode } from "react";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page-bg">
      <div className="auth-page-inner">{children}</div>
    </div>
  );
}

/** @deprecated Use AuthPageShell + AuthSwitchShell */
export function AuthLayout({
  children,
  panelTitle: _panelTitle,
  panelSubtitle: _panelSubtitle,
}: {
  children: ReactNode;
  panelTitle: string;
  panelSubtitle: string;
}) {
  return <AuthPageShell>{children}</AuthPageShell>;
}

/** @deprecated Use AuthBrandMark from auth-switch */
export function AuthBrandHeader() {
  return null;
}
