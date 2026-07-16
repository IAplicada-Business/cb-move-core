import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./types";
import { resolvePostAuthPath } from "./auth-routes";
import { mustResetPassword, type PostAuthPath } from "./password-reset";
import { isCliente, isStaff } from "./permissions";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  /** true até restaurar sessão do storage e carregar papéis do usuário */
  loading: boolean;
  pacienteId: string | null;
  isPaciente: boolean;
  signIn: (email: string, password: string) => Promise<PostAuthPath>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [roles, setRoles] = React.useState<AppRole[]>([]);
  const [pacienteId, setPacienteId] = React.useState<string | null>(null);
  const [isPaciente, setIsPaciente] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const rolesUserIdRef = React.useRef<string | null>(null);

  async function loadRoles(userId: string) {
    const [rolesResult, pacResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      (supabase as any).from("pacientes").select("id").eq("user_id", userId).maybeSingle(),
    ]);

    if (rolesResult.error) {
      console.error("loadRoles", rolesResult.error);
    }

    const fetchedRoles = ((rolesResult.data ?? []) as { role: AppRole }[]).map((r) => r.role);
    setRoles(fetchedRoles);

    const pacId = (pacResult.data as { id: string } | null)?.id ?? null;
    setPacienteId(pacId);
    setIsPaciente(isCliente(fetchedRoles) || (pacId !== null && !isStaff(fetchedRoles)));
    rolesUserIdRef.current = userId;
  }

  async function clearRoles() {
    setRoles([]);
    setPacienteId(null);
    setIsPaciente(false);
    rolesUserIdRef.current = null;
  }

  async function applySession(next: Session | null, options?: { reloadRoles?: boolean }) {
    setSession(next);
    if (!next?.user) {
      await clearRoles();
      return;
    }

    const shouldReload =
      options?.reloadRoles !== false && rolesUserIdRef.current !== next.user.id;
    if (shouldReload) {
      await loadRoles(next.user.id);
    }
  }

  React.useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      if (event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT") {
        await applySession(null);
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(nextSession);
        return;
      }

      if (nextSession?.user && (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")) {
        await applySession(nextSession);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await applySession(data.session);
      if (mounted) setLoading(false);
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void supabase.auth.getSession();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    roles,
    loading,
    pacienteId,
    isPaciente,
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) {
        await applySession(data.session);
        if (mustResetPassword(data.session.user)) return "/redefinir-senha";
        return resolvePostAuthPath(data.session.user.id);
      }
      return "/app";
    },
    signUp: async (email, password, fullName) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: fullName ? { full_name: fullName } : undefined,
        },
      });
      if (error) throw error;
    },
    signOut: async () => {
      await supabase.auth.signOut();
      await applySession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
