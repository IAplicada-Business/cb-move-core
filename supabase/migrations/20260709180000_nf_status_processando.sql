-- Status intermediário enquanto Focus/agência nacional processa o DPS
ALTER TYPE public.nf_status ADD VALUE IF NOT EXISTS 'processando';
