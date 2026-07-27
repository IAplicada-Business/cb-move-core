import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const payload = await req.json();
    const docKey = payload?.event?.data?.document?.key ?? payload?.document?.key;
    const eventName = payload?.event?.name;

    if (!docKey) return new Response("ok", { status: 200 });

    if (eventName === "auto_close" || eventName === "signature" || eventName === "close") {
      let relId: string | null = null;

      const { data: byKey } = await supabase
        .from("relatorios_atendimento")
        .select("id")
        .eq("clicksign_document_key", docKey)
        .maybeSingle();

      if (byKey?.id) {
        relId = byKey.id;
      } else {
        const { data: byLink } = await supabase
          .from("relatorios_atendimento")
          .select("id")
          .ilike("assinatura_link", `%${docKey}%`)
          .maybeSingle();
        relId = byLink?.id ?? null;
      }

      if (relId) {
        await supabase
          .from("relatorios_atendimento")
          .update({
            assinado: true,
            assinado_em: new Date().toISOString(),
            status: "assinado",
          })
          .eq("id", relId);
      }
    }
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("error", { status: 500 });
  }
});
