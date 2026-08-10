export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
};

/** Converte yyyy-mm-dd ou ISO → dd/mm/yy */
export const isoToDDMMYY = (iso: string | null | undefined) => {
  if (!iso) return "";
  const base = iso.includes("T") ? iso.split("T")[0] : iso.slice(0, 10);
  const [y, m, d] = base.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y.slice(-2)}`;
};

/** dd/mm/yy — ex.: 09/07/26 */
export const formatDateDDMMYY = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  if (typeof d === "string") {
    const base = d.includes("T") ? d.split("T")[0] : d.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
      const formatted = isoToDDMMYY(base);
      if (formatted) return formatted;
    }
  }
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = String(dt.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

/** Converte dd/mm/yy → yyyy-mm-dd (null se inválido) */
export const parseDDMMYYToISO = (input: string): string | null => {
  const m = input.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = 2000 + Number(m[3]);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/** Intervalo legível de semana útil — ex.: "20 – 24 jul 2026" */
export const formatSemanaIntervalo = (inicio: Date, fim: Date) => {
  const fmtDia = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(/\./g, "");
  const ano = fim.getFullYear();
  if (inicio.getMonth() === fim.getMonth()) {
    return `${inicio.getDate()} – ${fmtDia(fim)} ${ano}`;
  }
  return `${fmtDia(inicio)} – ${fmtDia(fim)} ${ano}`;
};

/** HH:mm 24h a partir de ISO */
export const isoToHHMM = (iso: string | null | undefined) => {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
};

/** dd/mm/yy HH:mm */
export const formatDateTimeDDMMYY = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  const time = dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatDateDDMMYY(dt)} ${time}`;
};

export const formatDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/** Último login — Hoje, Ontem ou dd/mm/yy (mockup Usuários). Comparação em fuso America/Sao_Paulo. */
const LAST_SIGN_IN_TZ = "America/Sao_Paulo";

function localDateKeyInTimeZone(d: Date, timeZone: string): string {
  return d.toLocaleDateString("en-CA", { timeZone });
}

export const formatLastSignIn = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";

  const todayKey = localDateKeyInTimeZone(new Date(), LAST_SIGN_IN_TZ);
  const signInKey = localDateKeyInTimeZone(dt, LAST_SIGN_IN_TZ);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKeyInTimeZone(yesterday, LAST_SIGN_IN_TZ);

  if (signInKey === todayKey) return "Hoje";
  if (signInKey === yesterdayKey) return "Ontem";
  return formatDateDDMMYY(dt);
};

export const formatCPF = (cpf: string | null | undefined) => {
  if (!cpf) return "";
  const v = cpf.replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

export const formatPhone = (p: string | null | undefined) => {
  if (!p) return "";
  const v = p.replace(/\D/g, "");
  if (v.length === 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (v.length === 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return p;
};

export const initials = (name: string | null | undefined) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Foto do usuário — Google OAuth, avatar_url ou picture no metadata. */
export function resolveUserAvatarUrl(
  user:
    | {
        user_metadata?: Record<string, unknown>;
        identities?: Array<{ identity_data?: Record<string, unknown> }>;
      }
    | null
    | undefined,
): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    (meta.photoURL as string | undefined);
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();

  for (const identity of user.identities ?? []) {
    const data = identity.identity_data ?? {};
    const url = (data.picture as string | undefined) ?? (data.avatar_url as string | undefined);
    if (typeof url === "string" && url.trim()) return url.trim();
  }

  return null;
}
