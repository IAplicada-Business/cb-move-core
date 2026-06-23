
-- ============================================================
-- STEP 1: EXTEND EXISTING ENUMS
-- ============================================================
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'vencido';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'aguardando_convenio';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'aguardando_alvara';
ALTER TYPE public.cobranca_status ADD VALUE IF NOT EXISTS 'regularizar_retroativa';

ALTER TYPE public.nf_status ADD VALUE IF NOT EXISTS 'erro';
ALTER TYPE public.nf_status ADD VALUE IF NOT EXISTS 'regularizada_retroativa';

-- ============================================================
-- STEP 2: NEW ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.regime_cobranca AS ENUM ('mensalista','por_sessao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.forma_pagamento AS ENUM ('boleto','deposito','transferencia','alvara_judicial','convenio_direto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_agendamento AS ENUM ('agendado','confirmado','realizado','faltou','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.frequencia_sigla AS ENUM ('P','F','FJ','NJ','RC','NR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.modelo_relatorio AS ENUM ('convencional','unimed','sharepoint');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 3: FISIOTERAPEUTAS (needed before profiles + pacientes FK)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fisioterapeutas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  registro_profissional text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fisioterapeutas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select fisios" ON public.fisioterapeutas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm write fisios" ON public.fisioterapeutas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm update fisios" ON public.fisioterapeutas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm delete fisios" ON public.fisioterapeutas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 4: PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text,
  fisioterapeuta_id uuid REFERENCES public.fisioterapeutas(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "profile select own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "profile insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "profile update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 5: ADD MISSING COLUMNS TO PACIENTES
-- ============================================================
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS regime_cobranca public.regime_cobranca NOT NULL DEFAULT 'mensalista',
  ADD COLUMN IF NOT EXISTS valor_mensal numeric(10,2),
  ADD COLUMN IF NOT EXISTS valor_sessao numeric(10,2),
  ADD COLUMN IF NOT EXISTS fisioterapeuta_id uuid REFERENCES public.fisioterapeutas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS advogado_nome text,
  ADD COLUMN IF NOT EXISTS advogado_email text,
  ADD COLUMN IF NOT EXISTS forma_pagamento_preferida public.forma_pagamento,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- STEP 6: PACIENTES_STATUS_HISTORICO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pacientes_status_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  alterado_por uuid REFERENCES auth.users(id),
  alterado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pacientes_status_historico ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select hist" ON public.pacientes_status_historico FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rec insert hist" ON public.pacientes_status_historico FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao') OR public.has_role(auth.uid(),'recepcao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 7: ADD MISSING COLUMNS TO COBRANCAS
-- ============================================================
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS competencia_mes int,
  ADD COLUMN IF NOT EXISTS competencia_ano int,
  ADD COLUMN IF NOT EXISTS regime public.regime_cobranca,
  ADD COLUMN IF NOT EXISTS qtd_sessoes int,
  ADD COLUMN IF NOT EXISTS servico text,
  ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento,
  ADD COLUMN IF NOT EXISTS boleto_url text,
  ADD COLUMN IF NOT EXISTS cora_invoice_id text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- ============================================================
-- STEP 8: ADD MISSING COLUMNS TO NOTAS_FISCAIS
-- ============================================================
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo public.paciente_tipo,
  ADD COLUMN IF NOT EXISTS destinatario_nome text,
  ADD COLUMN IF NOT EXISTS destinatario_documento text,
  ADD COLUMN IF NOT EXISTS corpo_paciente_nome text,
  ADD COLUMN IF NOT EXISTS corpo_paciente_cpf text,
  ADD COLUMN IF NOT EXISTS corpo_dias_atendidos text,
  ADD COLUMN IF NOT EXISTS corpo_total_sessoes int,
  ADD COLUMN IF NOT EXISTS corpo_valor_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS corpo_numero_processo text,
  ADD COLUMN IF NOT EXISTS emissao date,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS template_versionado_id uuid;

-- ============================================================
-- STEP 9: AGENDAMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
  fisioterapeuta_id uuid REFERENCES public.fisioterapeutas(id) ON DELETE SET NULL,
  inicio timestamptz NOT NULL,
  duracao_min int NOT NULL DEFAULT 50,
  servico text,
  status public.status_agendamento NOT NULL DEFAULT 'agendado',
  criado_por uuid REFERENCES auth.users(id),
  canal_origem text DEFAULT 'whatsapp'
);
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select agendamentos" ON public.agendamentos FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rec write agendamentos" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao') OR public.has_role(auth.uid(),'recepcao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rec update agendamentos" ON public.agendamentos FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao') OR public.has_role(auth.uid(),'recepcao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst delete agendamentos" ON public.agendamentos FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 10: SESSOES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  fisioterapeuta_id uuid REFERENCES public.fisioterapeutas(id) ON DELETE SET NULL,
  data date NOT NULL,
  hora time,
  sigla public.frequencia_sigla NOT NULL DEFAULT 'P',
  cancelada_com_antecedencia boolean,
  recupera_sessao_id uuid REFERENCES public.sessoes(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sessoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select sessoes" ON public.sessoes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rec write sessoes" ON public.sessoes FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao') OR public.has_role(auth.uid(),'recepcao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rec update sessoes" ON public.sessoes FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao') OR public.has_role(auth.uid(),'recepcao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst delete sessoes" ON public.sessoes FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 11: RELATORIOS_ATENDIMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.relatorios_atendimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  modelo public.modelo_relatorio NOT NULL,
  competencia_mes int NOT NULL,
  competencia_ano int NOT NULL,
  pdf_url text,
  assinado boolean NOT NULL DEFAULT false,
  assinado_em timestamptz,
  assinatura_link text,
  template_versionado_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.relatorios_atendimento ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select relatorios" ON public.relatorios_atendimento FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst write relatorios" ON public.relatorios_atendimento FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst update relatorios" ON public.relatorios_atendimento FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst delete relatorios" ON public.relatorios_atendimento FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 12: INSTRUMENTOS_CLINICOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instrumentos_clinicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  categoria text NOT NULL,
  versao int NOT NULL DEFAULT 1,
  descricao text,
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ativo',
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instrumentos_clinicos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select instrumentos" ON public.instrumentos_clinicos FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm write instrumentos" ON public.instrumentos_clinicos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm update instrumentos" ON public.instrumentos_clinicos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm delete instrumentos" ON public.instrumentos_clinicos FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 13: INSTRUMENTOS_APLICADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instrumentos_aplicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  instrumento_id uuid NOT NULL REFERENCES public.instrumentos_clinicos(id),
  versao_aplicada int NOT NULL,
  resultados jsonb NOT NULL,
  aplicado_por uuid REFERENCES auth.users(id),
  aplicado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instrumentos_aplicados ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select inst_aplic" ON public.instrumentos_aplicados FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "fisio write inst_aplic" ON public.instrumentos_aplicados FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao') OR public.has_role(auth.uid(),'fisio')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 14: TEMPLATES_VERSIONADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.templates_versionados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  tipo text NOT NULL,
  modelo text,
  versao int NOT NULL DEFAULT 1,
  conteudo jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(codigo, versao)
);
ALTER TABLE public.templates_versionados ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select templates" ON public.templates_versionados FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm write templates" ON public.templates_versionados FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm update templates" ON public.templates_versionados FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm delete templates" ON public.templates_versionados FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 15: NOTAS_FISCAIS_ENVIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notas_fiscais_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  destinatarios text[] NOT NULL,
  assunto text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais_envios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth select nf_envios" ON public.notas_fiscais_envios FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst write nf_envios" ON public.notas_fiscais_envios FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 16: TIGHTEN RLS ON EXISTING TABLES
-- ============================================================
DROP POLICY IF EXISTS "authenticated all convenios" ON public.convenios;
DO $$ BEGIN
  CREATE POLICY "auth select convenios" ON public.convenios FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm write convenios" ON public.convenios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm update convenios" ON public.convenios FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "adm delete convenios" ON public.convenios FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "authenticated all pacientes" ON public.pacientes;
DO $$ BEGIN
  CREATE POLICY "auth select pacientes" ON public.pacientes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rec write pacientes" ON public.pacientes FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao') OR public.has_role(auth.uid(),'recepcao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "rec update pacientes" ON public.pacientes FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao') OR public.has_role(auth.uid(),'recepcao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst delete pacientes" ON public.pacientes FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "authenticated all cobrancas" ON public.cobrancas;
DO $$ BEGIN
  CREATE POLICY "auth select cobrancas" ON public.cobrancas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst write cobrancas" ON public.cobrancas FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst update cobrancas" ON public.cobrancas FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst delete cobrancas" ON public.cobrancas FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "authenticated all nf" ON public.notas_fiscais;
DO $$ BEGIN
  CREATE POLICY "auth select nf" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst write nf" ON public.notas_fiscais FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst update nf" ON public.notas_fiscais FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gst delete nf" ON public.notas_fiscais FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestao')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 17: UPDATE handle_new_user TO ALSO INSERT INTO PROFILES
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'recepcao')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 18: SEEDS
-- ============================================================
INSERT INTO public.convenios (nome) VALUES
  ('Unimed'),
  ('Centro Clínico Gaúcho'),
  ('Bradesco Seguros')
ON CONFLICT DO NOTHING;

INSERT INTO public.templates_versionados (codigo, tipo, modelo, versao, conteudo) VALUES
  ('RQ.GPS.09.105','relatorio_atendimento','convencional',1,'{"placeholders":["paciente_nome","competencia","evolucao_resumo"]}'),
  ('RQ.GPS.09.106','relatorio_atendimento','unimed',1,'{"placeholders":["paciente_nome","cid","sessoes","processo"]}'),
  ('RQ.GPS.09.107','relatorio_atendimento','sharepoint',1,'{"placeholders":["paciente_nome","sessoes","fisio"]}'),
  ('RQ.GPS.07.001','nota_fiscal','particular',1,'{"destinatario":"paciente"}'),
  ('RQ.GPS.07.002','nota_fiscal','convenio',1,'{"destinatario":"convenio"}'),
  ('RQ.GPS.07.003','nota_fiscal','judicial',1,'{"destinatario":"convenio","corpo":["paciente","cpf","processo","sessoes"]}'),
  ('RQ.GPS.08.001','email_nf','particular',1,'{"assunto":"NF {{paciente}} - {{competencia}}","corpo":"placeholder"}'),
  ('RQ.GPS.08.002','email_nf','convenio',1,'{"assunto":"NF {{convenio}} - {{competencia}}","corpo":"placeholder"}'),
  ('RQ.GPS.08.003','email_nf','judicial',1,'{"assunto":"NF {{paciente}} - Proc {{processo}}","corpo":"placeholder"}')
ON CONFLICT (codigo, versao) DO NOTHING;

INSERT INTO public.instrumentos_clinicos (codigo, nome, categoria, versao, descricao) VALUES
  ('RQ.GPS.04.012','Avaliação da Face','Neurológica',1,'Avaliação de simetria e mobilidade facial')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- STEP 19: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cobrancas_paciente ON public.cobrancas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_competencia ON public.cobrancas(competencia_ano, competencia_mes);
CREATE INDEX IF NOT EXISTS idx_nf_paciente ON public.notas_fiscais(paciente_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_paciente ON public.sessoes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_data ON public.sessoes(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_inicio ON public.agendamentos(inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_fisio ON public.agendamentos(fisioterapeuta_id);
