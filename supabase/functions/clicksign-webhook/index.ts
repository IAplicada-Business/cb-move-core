import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const payload = await req.json();
    // Payload ClickSign: { event: { name: "auto_close", data: { document: { key: "..." } } } }
    const docKey = payload?.event?.data?.document?.key;
    const eventName = payload?.event?.name;
    if (!docKey) return new Response("ok", { status: 200 });

    if (eventName === "auto_close" || eventName === "signature") {
      // Busca relatório pelo assinatura_link que contém o docKey
      const { data: rel } = await supabase
        .from("relatorios_atendimento")
        .select("id")
        .ilike("assinatura_link", `%${docKey}%`)
        .single();
      if (rel) {
        await supabase
          .from("relatorios_atendimento")
          .update({
            assinado: true,
            assinado_em: new Date().toISOString(),
            status: "assinado",
          })
          .eq("id", rel.id);
      }
    }
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("error", { status: 500 });
  }
});
