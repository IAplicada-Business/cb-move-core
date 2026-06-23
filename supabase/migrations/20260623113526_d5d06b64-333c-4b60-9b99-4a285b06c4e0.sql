
-- =========== ROLES ===========
CREATE TYPE public.app_role AS ENUM ('admin', 'gestao', 'recepcao', 'fisio');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- handle_new_user: novo signup recebe papel 'recepcao'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'recepcao')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== ENUMS DE DOMÍNIO ===========
CREATE TYPE public.paciente_tipo AS ENUM ('particular', 'judicial', 'convenio', 'puc');
CREATE TYPE public.cobranca_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE public.nf_status AS ENUM ('pendente', 'emitida', 'cancelada');

-- =========== UPDATED_AT helper ===========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========== CONVENIOS ===========
CREATE TABLE public.convenios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convenios TO authenticated;
GRANT ALL ON public.convenios TO service_role;
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all convenios" ON public.convenios
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE TRIGGER trg_convenios_updated BEFORE UPDATE ON public.convenios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== PACIENTES ===========
CREATE TABLE public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  tipo public.paciente_tipo NOT NULL DEFAULT 'particular',
  convenio_id UUID REFERENCES public.convenios(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacientes TO authenticated;
GRANT ALL ON public.pacientes TO service_role;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all pacientes" ON public.pacientes
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE TRIGGER trg_pacientes_updated BEFORE UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== COBRANCAS ===========
CREATE TABLE public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  tipo public.paciente_tipo NOT NULL DEFAULT 'particular',
  status public.cobranca_status NOT NULL DEFAULT 'pendente',
  vencimento DATE,
  pago_em DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all cobrancas" ON public.cobrancas
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE TRIGGER trg_cobrancas_updated BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_cobrancas_created ON public.cobrancas(created_at DESC);
CREATE INDEX idx_cobrancas_status ON public.cobrancas(status);

-- =========== NOTAS FISCAIS ===========
CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  numero TEXT,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.nf_status NOT NULL DEFAULT 'pendente',
  emitida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all nf" ON public.notas_fiscais
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE TRIGGER trg_nf_updated BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
