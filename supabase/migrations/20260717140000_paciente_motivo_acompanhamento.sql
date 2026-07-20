-- Motivo do acompanhamento (por que o paciente está em tratamento na clínica).

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS motivo_acompanhamento text;

COMMENT ON COLUMN public.pacientes.motivo_acompanhamento IS 'Motivo/diagnóstico que justifica o acompanhamento fisioterapêutico';
