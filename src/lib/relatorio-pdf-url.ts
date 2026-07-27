import { supabase } from "@/integrations/supabase/client";

export const RELATORIO_PDF_BUCKET = "relatorios-atendimento";
const SIGNED_URL_TTL_SEC = 3600;

/** Extrai path no bucket a partir de path relativo ou URL legada pública. */
export function resolveRelatorioStoragePath(pdfRef: string | null | undefined): string | null {
  if (!pdfRef?.trim()) return null;
  const trimmed = pdfRef.trim();
  if (!trimmed.startsWith("http")) return trimmed;
  const marker = `/${RELATORIO_PDF_BUCKET}/`;
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(trimmed.slice(idx + marker.length).split("?")[0] ?? "");
}

/** Resolve URL abrível: signed URL para paths privados; mantém URLs http legadas. */
export async function resolveRelatorioPdfUrl(
  pdfRef: string | null | undefined,
): Promise<string | null> {
  if (!pdfRef?.trim()) return null;
  if (pdfRef.startsWith("http")) return pdfRef;

  const path = resolveRelatorioStoragePath(pdfRef);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(RELATORIO_PDF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error) throw error;
  return data.signedUrl;
}

export async function openRelatorioPdf(pdfRef: string | null | undefined): Promise<void> {
  const url = await resolveRelatorioPdfUrl(pdfRef);
  if (!url) throw new Error("PDF indisponível");
  window.open(url, "_blank", "noopener,noreferrer");
}
