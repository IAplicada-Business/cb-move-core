import type { LucideIcon } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AuthContext = "admin" | "paciente";

/** Profissional de saúde com celular — painel colorido do login (desktop). */
export const AUTH_PANEL_IMAGE = "/auth-panel-medico.jpg";

const PANELS: Record<
  AuthContext,
  {
    left: { title: string; body: string; cta: string; target: AuthContext };
    right: { title: string; body: string; cta: string; target: AuthContext };
    formTitle: string;
    formSubtitle: string;
  }
> = {
  admin: {
    left: {
      title: "Portal do paciente",
      body: "Acompanhe relatórios, documentos e a evolução do seu tratamento com a equipe CB MOVE.",
      cta: "Sou paciente",
      target: "paciente",
    },
    right: {
      title: "Equipe CB MOVE",
      body: "Gestão clínica e financeira — agenda, prontuário e cobranças.",
      cta: "Sou da equipe",
      target: "admin",
    },
    formTitle: "Entrar na equipe",
    formSubtitle: "Fisioterapeutas, secretaria e administração",
  },
  paciente: {
    left: {
      title: "Portal do paciente",
      body: "Acompanhe relatórios, documentos e a evolução do seu tratamento com a equipe CB MOVE.",
      cta: "Sou paciente",
      target: "paciente",
    },
    right: {
      title: "Equipe CB MOVE",
      body: "Gestão clínica e financeira — agenda, prontuário e cobranças.",
      cta: "Sou da equipe",
      target: "admin",
    },
    formTitle: "Portal do paciente",
    formSubtitle: "Acesso ao acompanhamento do seu tratamento",
  },
};

export function AuthSwitchShell({
  mode,
  onModeChange,
  children,
}: {
  mode: AuthContext;
  onModeChange: (value: AuthContext) => void;
  children: ReactNode;
}) {
  const copy = PANELS[mode];
  const isPaciente = mode === "paciente";

  return (
    <div className={cn("auth-switch-card", isPaciente && "auth-switch--paciente")}>
      <div className="auth-switch-mobile">
        <AuthBrandMark className="mx-auto mb-5 w-fit" />
        <AuthSwitch value={mode} onChange={onModeChange} className="mb-3" />
        <h1 className="text-center text-xl font-bold tracking-tight text-cb-ink">
          {copy.formTitle}
        </h1>
        <p className="mt-1 text-center text-xs text-cb-muted">{copy.formSubtitle}</p>
      </div>

      <div className="auth-switch-panel auth-switch-panel--left">
        {!isPaciente && <AuthPanelBackdrop />}
        <div className="auth-switch-panel-content">
          <h3 className="text-xl font-semibold">{PANELS.admin.left.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/90">{PANELS.admin.left.body}</p>
          {!isPaciente && (
            <button
              type="button"
              className="auth-switch-panel-btn"
              onClick={() => onModeChange(PANELS.admin.left.target)}
            >
              {PANELS.admin.left.cta}
            </button>
          )}
        </div>
      </div>

      <div className="auth-switch-forms">
        <div className="auth-switch-form-wrap">
          <div className="auth-switch-desktop-heading" aria-hidden="true">
            <h1 className="text-2xl font-bold tracking-tight text-cb-ink">{copy.formTitle}</h1>
            <p className="mt-1 mb-5 text-sm text-cb-muted">{copy.formSubtitle}</p>
          </div>
          {children}
        </div>
      </div>

      <div className="auth-switch-panel auth-switch-panel--right">
        {isPaciente && <AuthPanelBackdrop />}
        <div className="auth-switch-panel-content">
          <h3 className="text-xl font-semibold">{PANELS.admin.right.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/90">{PANELS.admin.right.body}</p>
          {isPaciente && (
            <button
              type="button"
              className="auth-switch-panel-btn"
              onClick={() => onModeChange(PANELS.admin.right.target)}
            >
              {PANELS.admin.right.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthPanelBackdrop() {
  return (
    <div className="auth-switch-panel-backdrop" aria-hidden>
      <img src={AUTH_PANEL_IMAGE} alt="" className="auth-switch-panel-backdrop-photo" />
      <div className="auth-switch-panel-backdrop-overlay" />
    </div>
  );
}

export function AuthBrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="cb-pin-halo grid h-11 w-11 place-items-center rounded-full p-[2px]">
        <div className="grid h-full w-full place-items-center rounded-full bg-white text-cb-cyan-600">
          <span className="text-xl font-bold leading-none">∞</span>
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-wide text-cb-cyan-900">CB MOVE</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cb-cyan-700">
          Neuroscience
        </div>
      </div>
    </div>
  );
}

export function AuthField({
  icon: Icon,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }) {
  return (
    <label className={cn("auth-switch-field", className)}>
      <span className="grid place-items-center text-cb-muted">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <input {...props} />
    </label>
  );
}

/** @deprecated Use AuthSwitchShell panel buttons instead */
export function AuthSwitch({
  value,
  onChange,
  className,
}: {
  value: AuthContext;
  onChange: (value: AuthContext) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-1 rounded-full border border-border bg-muted/40 p-1 sm:gap-2",
        className,
      )}
    >
      {(["admin", "paciente"] as const).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "min-w-0 flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs",
            value === id
              ? "bg-cb-cyan-600 text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="sm:hidden">{id === "admin" ? "Equipe" : "Paciente"}</span>
          <span className="hidden sm:inline">
            {id === "admin" ? "Equipe CB MOVE" : "Portal paciente"}
          </span>
        </button>
      ))}
    </div>
  );
}
