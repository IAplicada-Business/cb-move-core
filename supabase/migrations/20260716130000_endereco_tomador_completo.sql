-- Corrige gap pré-existente na emissão de NF via Focus: o schema da NFS-e Nacional exige o
-- número do endereço (elemento "nro") como campo próprio, separado do logradouro — mas nem
-- `convenios` nem o fluxo de tomador `particular` em emit-nf repassavam essa estrutura completa
-- (só `convenios.endereco` como texto único, sem numero/complemento/bairro; e o paciente
-- particular nunca tinha seu próprio endereço repassado para a Focus, apenas e-mail/telefone).
-- Descoberto ao testar a automação de NF pós-pagamento Cora (2026-07-16) com um convênio
-- sintético completo — a Focus rejeitou (422) por falta de "nro". Nenhuma NF de convênio real
-- jamais foi emitida com sucesso via Focus até hoje (todas as reais são fiscal_provider =
-- 'drive_import', importadas de emissões manuais anteriores) — ou seja, esse caminho de código
-- nunca tinha sido exercitado de ponta a ponta antes deste teste.

ALTER TABLE public.convenios
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text;

COMMENT ON COLUMN public.convenios.numero IS
  'Número do endereço do tomador — obrigatório (elemento "nro") pelo schema da NFS-e Nacional quando um endereço é informado.';
