import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { reportLovableError } from "./lovable-error-reporting";

const PREFIX = "[CBmove]";

export function logDiagnostic(
  level: "info" | "warn" | "error",
  scope: string,
  message: string,
  detail?: unknown,
) {
  const line = `${PREFIX} [${scope}] ${message}`;
  if (detail !== undefined) {
    if (level === "error") console.error(line, detail);
    else if (level === "warn") console.warn(line, detail);
    else console.info(line, detail);
  } else if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const diag = {
  info: (scope: string, message: string, detail?: unknown) =>
    logDiagnostic("info", scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown) =>
    logDiagnostic("warn", scope, message, detail),
  error: (scope: string, message: string, detail?: unknown) =>
    logDiagnostic("error", scope, message, detail),
};

declare global {
  interface Window {
    __cbmoveDiagnosticsInstalled?: boolean;
  }
}

export function installClientDiagnostics() {
  if (typeof window === "undefined") return;
  if (window.__cbmoveDiagnosticsInstalled) return;
  window.__cbmoveDiagnosticsInstalled = true;

  diag.info("boot", "diagnósticos instalados", {
    href: window.location.href,
    pathname: window.location.pathname,
    readyState: document.readyState,
  });

  window.addEventListener("error", (event) => {
    diag.error("global", "erro não capturado (window.error)", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
    reportLovableError(event.error ?? event.message, { boundary: "window_onerror" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    diag.error("global", "promise rejeitada sem catch", {
      reason: event.reason,
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
    });
    reportLovableError(event.reason, { boundary: "unhandledrejection" });
  });

  window.addEventListener("pageshow", (event) => {
    diag.info("navigation", event.persisted ? "restaurado do bfcache" : "pageshow", {
      pathname: window.location.pathname,
    });
  });
}

if (typeof window !== "undefined") {
  installClientDiagnostics();
}

export function createQueryClientWithDiagnostics() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Sem isso, o padrão do React Query é staleTime: 0 — toda query é
        // refeita a cada montagem/foco de janela, o que deixa a navegação
        // entre menus lenta (spinner em toda troca de aba, mesmo revisitando
        // uma tela recém-carregada). 30s é suficiente para listas
        // administrativas que não mudam a cada segundo.
        staleTime: 30_000,
        // Com 5min, sair de uma tela e voltar depois do intervalo descartava o cache
        // e a tela voltava do zero (spinner). 30min mantém a última leitura em mão:
        // ela aparece na hora e o refetch acontece em segundo plano.
        gcTime: 30 * 60_000,
        // Trocar de aba, minimizar a janela ou voltar do bloqueio de tela disparava
        // um refetch de todas as queries montadas — a tela inteira parecia recarregar.
        // Os dados continuam frescos pelas invalidações das mutations e pelo refetch
        // ao montar/navegar.
        refetchOnWindowFocus: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        diag.error("react-query", "falha em query", {
          queryKey: query.queryKey,
          error,
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        diag.error("react-query", "falha em mutation", {
          mutationKey: mutation.options.mutationKey,
          error,
        });
      },
    }),
  });
}
