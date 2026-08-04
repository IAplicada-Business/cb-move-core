-- Reajuste plano mensalista e sessão simples — vigência agosto/2026
-- Escopo: apenas valores exatos anteriores (1028 → 1110, 266 → 287)
-- Cobranças já emitidas (Jan–Jul/2026) não são alteradas.

UPDATE public.pacientes
SET valor_mensal = 1110.00
WHERE valor_mensal = 1028.00;

UPDATE public.pacientes
SET valor_sessao = 287.00
WHERE valor_sessao = 266.00;

-- Validação esperada após apply:
-- SELECT count(*) FROM pacientes WHERE valor_mensal = 1110;  -- ~50
-- SELECT count(*) FROM pacientes WHERE valor_sessao = 287;   -- ~39
