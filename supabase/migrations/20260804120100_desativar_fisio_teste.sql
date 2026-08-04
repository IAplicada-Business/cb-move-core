-- Desativar registro de teste (não excluir — preserva FKs)
UPDATE public.fisioterapeutas
SET ativo = false
WHERE nome ILIKE '%Fisio Teste CBMove%';
