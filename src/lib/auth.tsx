import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./types";
import { resolvePostAuthPath } from "./auth-routes";
import { mustResetPassword, type PostAuthPath } from "./password-reset";
import { isCliente, isStaff } from "./permissions";
import { syncAccessContext, invalidateAccessContext } from "./access-context";
import { diag } from "./client-diagnostics";
import { withTimeout } from "./edge-functions";

const LOAD_ROLES_TIMEOUT_MS = 8_000;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  fisioterapeutaId: string | null;
  /** true até restaurar sessão do storage e carregar papéis do usuário */
  loading: boolean;
  pacienteId: string | null;
  isPaciente: boolean;
  signIn: (email: string, password: string) => Promise<PostAuthPath>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Recarrega papéis/perfil do usuário logado (menu + guards). */
  refreshRoles: () => Promise<void>;
  /** Sincroniza sessão OAuth/callback no provider antes de navegar. */
  completeSignIn: (session: Session) => Promise<PostAuthPath>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [roles, setRoles] = React.useState<AppRole[]>([]);
  const [fisioterapeutaId, setFisioterapeutaId] = React.useState<string | null>(null);
  const [pacienteId, setPacienteId] = React.useState<string | null>(null);
  const [isPaciente, setIsPaciente] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const rolesUserIdRef = React.useRef<string | null>(null);
  const rolesLoadingUserIdRef = React.useRef<string | null>(null);
  const loadRolesEpochRef = React.useRef(0);

  async function loadRoles(userId: string, options?: { force?: boolean }) {
    if (options?.force) {
      invalidateAccessContext();
    } else if (rolesUserIdRef.current === userId) {
      return;
    }

    if (!options?.force && rolesLoadingUserIdRef.current === userId) {
      return;
    }

    const epoch = ++loadRolesEpochRef.current;
    rolesLoadingUserIdRef.current = userId;
    diag.info("auth", "carregando papéis", { userId, force: Boolean(options?.force) });

    try {
      const [rolesResult, profileResult, pacResult] = await withTimeout(
        Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", userId),
          supabase.from("profiles").select("fisioterapeuta_id").eq("id", userId).maybeSingle(),
          supabase.from("pacientes").select("id").eq("user_id", userId).maybeSingle(),
        ]),
        LOAD_ROLES_TIMEOUT_MS,
      );

      if (epoch !== loadRolesEpochRef.current) return;

      if (rolesResult.error) {
        diag.error("auth", "falha ao buscar user_roles", rolesResult.error);
        return;
      }
      if (profileResult.error) {
        diag.error("auth", "falha ao buscar profile", profileResult.error);
      }
      if (pacResult.error) {
        diag.error("auth", "falha ao buscar paciente vinculado", pacResult.error);
      }

      const fetchedRoles = ((rolesResult.data ?? []) as { role: AppRole }[]).map((r) => r.role);
      const fetchedFisioId = profileResult.error
        ? fisioterapeutaId
        : ((profileResult.data as { fisioterapeuta_id: string | null } | null)?.fisioterapeuta_id ??
          null);

      setRoles(fetchedRoles);
      if (!profileResult.error) {
        setFisioterapeutaId(fetchedFisioId);
      }

      const pacId = pacResult.error
        ? pacienteId
        : ((pacResult.data as { id: string } | null)?.id ?? null);
      if (!pacResult.error) {
        setPacienteId(pacId);
      }
      setIsPaciente(isCliente(fetchedRoles) || (pacId !== null && !isStaff(fetchedRoles)));
      rolesUserIdRef.current = userId;
      syncAccessContext({
        roles: fetchedRoles,
        fisioterapeutaId: fetchedFisioId,
      });

      diag.info("auth", "papéis carregados", {
        userId,
        roles: fetchedRoles,
        fisioterapeutaId: fetchedFisioId,
        pacienteId: pacId,
        isPaciente: isCliente(fetchedRoles) || (pacId !== null && !isStaff(fetchedRoles)),
      });
    } catch (error) {
      diag.error("auth", "loadRoles falhou ou expirou", error);
    } finally {
      if (rolesLoadingUserIdRef.current === userId && epoch === loadRolesEpochRef.current) {
        rolesLoadingUserIdRef.current = null;
      }
    }
  }

  async function clearRoles() {
    setRoles([]);
    setFisioterapeutaId(null);
    setPacienteId(null);
    setIsPaciente(false);
    rolesUserIdRef.current = null;
    rolesLoadingUserIdRef.current = null;
    loadRolesEpochRef.current += 1;
    syncAccessContext(null);
  }

  async function applySession(
    next: Session | null,
    options?: { reloadRoles?: boolean; awaitRoles?: boolean },
  ) {
    setSession(next);
    if (!next?.user) {
      await clearRoles();
      return;
    }

    const shouldReload = options?.reloadRoles !== false && rolesUserIdRef.current !== next.user.id;
    if (!shouldReload) return;

    const rolesPromise = loadRoles(next.user.id);
    if (options?.awaitRoles) {
      await rolesPromise;
    }
  }

  React.useEffect(() => {
    let mounted = true;

    const loadingWatchdog = window.setTimeout(() => {
      if (mounted) {
        diag.warn("auth", "bootstrap ainda em loading após 8s — possível travamento no reload", {
          pathname: window.location.pathname,
        });
      }
    }, 8_000);

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      diag.info("auth", `onAuthStateChange: ${event}`, {
        hasSession: Boolean(nextSession),
        userId: nextSession?.user?.id,
      });

      if (event === "INITIAL_SESSION") return;

      // Evita deadlock: não chamar Supabase dentro do callback de auth.
      window.setTimeout(() => {
        if (!mounted) return;

        void (async () => {
          if (event === "SIGNED_OUT") {
            await applySession(null);
            return;
          }

          if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
            setSession(nextSession);
            return;
          }

          if (nextSession?.user && (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY")) {
            try {
              await applySession(nextSession);
            } catch (error) {
              diag.error("auth", `falha ao aplicar sessão (${event})`, error);
            }
          }
        })();
      }, 0);
    });

    void (async () => {
      try {
        diag.info("auth", "bootstrap: restaurando sessão do storage");
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          diag.error("auth", "bootstrap: getSession retornou erro", error);
        }
        if (!mounted) return;

        diag.info("auth", "bootstrap: sessão restaurada", {
          hasSession: Boolean(data.session),
          userId: data.session?.user?.id,
        });

        setSession(data.session);
        if (data.session?.user) {
          await loadRoles(data.session.user.id);
        } else {
          await clearRoles();
        }
      } catch (error) {
        diag.error("auth", "bootstrap: exceção ao restaurar sessão", error);
      } finally {
        if (mounted) {
          setLoading(false);
          window.clearTimeout(loadingWatchdog);
          diag.info("auth", "bootstrap concluído", { loading: false });
        }
      }
    })();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      diag.info("auth", "aba visível — revalidando sessão e papéis");
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          diag.error("auth", "getSession ao voltar à aba falhou", error);
          return;
        }
        diag.info("auth", "sessão revalidada", { hasSession: Boolean(data.session) });
        if (data.session?.user) {
          void loadRoles(data.session.user.id, { force: true });
        }
      });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      window.clearTimeout(loadingWatchdog);
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const refreshRoles = React.useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    await loadRoles(uid, { force: true });
  }, [session?.user?.id]);

  const completeSignIn = React.useCallback(async (nextSession: Session): Promise<PostAuthPath> => {
    await applySession(nextSession, { awaitRoles: true });
    if (mustResetPassword(nextSession.user)) return "/redefinir-senha";
    return resolvePostAuthPath(nextSession.user.id);
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    roles,
    fisioterapeutaId,
    loading,
    pacienteId,
    isPaciente,
    refreshRoles,
    completeSignIn,
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) return completeSignIn(data.session);
      return "/app";
    },
    signInWithGoogle: async () => {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    },
    signUp: async () => {
      throw new Error(
        "Cadastro disponível apenas pela administração. Peça acesso em Equipe → Usuários.",
      );
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
