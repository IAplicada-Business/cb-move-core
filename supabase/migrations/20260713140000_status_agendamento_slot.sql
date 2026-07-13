-- Status de slot na agenda (indisponível / férias / horário extra)

ALTER TYPE public.status_agendamento ADD VALUE IF NOT EXISTS 'indisponivel';
ALTER TYPE public.status_agendamento ADD VALUE IF NOT EXISTS 'ferias';
ALTER TYPE public.status_agendamento ADD VALUE IF NOT EXISTS 'horario_extra';
