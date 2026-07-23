-- Hotfix: remove políticas SELECT abertas remanescentes em financeiro.

DROP POLICY IF EXISTS "authenticated all cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "auth select cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "paciente_ve_proprias_cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "scoped select cobrancas" ON public.cobrancas;
CREATE POLICY "paciente_ve_proprias_cobrancas"
  ON public.cobrancas FOR SELECT TO authenticated
  USING (paciente_id = public.paciente_logado());
CREATE POLICY "scoped select cobrancas"
  ON public.cobrancas FOR SELECT TO authenticated
  USING (public.staff_can_view_finance());

DROP POLICY IF EXISTS "authenticated all nf" ON public.notas_fiscais;
DROP POLICY IF EXISTS "auth select nf" ON public.notas_fiscais;
DROP POLICY IF EXISTS "scoped select nf" ON public.notas_fiscais;
CREATE POLICY "scoped select nf"
  ON public.notas_fiscais FOR SELECT TO authenticated
  USING (public.staff_can_view_finance());

DROP POLICY IF EXISTS "auth select nf_envios" ON public.notas_fiscais_envios;
DROP POLICY IF EXISTS "scoped select nf_envios" ON public.notas_fiscais_envios;
CREATE POLICY "scoped select nf_envios"
  ON public.notas_fiscais_envios FOR SELECT TO authenticated
  USING (
    public.staff_can_view_finance()
    AND EXISTS (
      SELECT 1
      FROM public.notas_fiscais nf
      WHERE nf.id = nota_fiscal_id
    )
  );
