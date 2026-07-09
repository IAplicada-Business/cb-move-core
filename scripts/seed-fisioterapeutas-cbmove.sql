-- Seed: fisioterapeutas CB MOVE (fonte: Registro Relógio Ponto / Drive cliente)
-- Idempotente por e-mail. Rode no SQL Editor ou: python scripts/apply-seed-fisioterapeutas.py
-- Não inclui CPF/PIS — apenas campos usados pela agenda.

INSERT INTO public.fisioterapeutas (nome, email, registro_profissional, ativo)
SELECT v.nome, v.email, v.crefito, true
FROM (
  VALUES
    ('Adriano de Lima Cezar', 'adrianolimacezar@gmail.com', '368530-F'),
    ('Brenda Lacerda Farias', 'lacerdabrenda21@gmail.com', '371627-F'),
    ('Camila Aguiar Pereira', 'fisiocamilap@gmail.com', '140129-F'),
    ('Carlos Eduardo Moraes Oliveira', 'moraes.cadu98@gmail.com', '355561-F'),
    ('Charlene Brito de Oliveira', 'cbmoveneuro@gmail.com', '122334-F'),
    ('Daniele Martins Moraes', 'danielemoraes2@gmail.com', '187872-F'),
    ('Diego Silveira de Paula Xavier', 'diegoxavier.fisio@gmail.com', '5417831-F'),
    ('Fernanda Eduarda Pereira Ferreira', 'fernandapereira.fisioterapia@gmail.com', '418545-F'),
    ('Gabriel Arrosi Fracaso', 'gabrielarrosi@gmail.com', '406583-F'),
    ('Gabriel Romagna da Costa', 'gabrielcoxta@gmail.com', '195779-F'),
    ('Gelson Leonardo dos Santos Klagenberg', 'leoklagenberg@gmail.com', '366531-F'),
    ('Henrique Mollmann Pedrotti', 'hiquepedrotti@gmail.com', '382900-F'),
    ('Kelen Silveira da Rosa', 'kelensilveira4@gmail.com', '221255-F'),
    ('Leonardo Pires Batista', 'leonardopb15@hotmail.com', NULL),
    ('Lorenzo Caon Da Silva', 'lorenzocaon@gmail.com', '391561-F'),
    ('Lucas da Silva Santos', 'fisiolucas.dsantos@gmail.com', '337354-F'),
    ('Mathias Mariani de Campos Velho Teixeira', 'mathiasteixeira5@gmail.com', '420235-F'),
    ('Ohana Figueiredo Medeiros', 'fisioterapiaohana@gmail.com', '346745-F'),
    ('Raisa Machado Alves', 'raisa04@hotmail.com', '116873-F'),
    ('Rebeca Andrade de Mello', 'rebecamello.a@gmail.com', '308344-F'),
    ('Rinaldo Pietrowski Pinto', 'rinaldopietrowski@gmail.com', '221471-F'),
    ('Taiane dos Santos Soares', 'taiane.soaress@hotmail.com', '300991-F'),
    ('Thales Escalante', 'thales.escalante@gmail.com', '343809-F'),
    ('Vitória Vicenza Pedroso da Silva', 'vicenzavitoria@gmail.com', NULL),
    ('William Vinícius Monteiro Pacheco', 'williammonteiro1988@gmail.com', '312099-F')
) AS v(nome, email, crefito)
WHERE NOT EXISTS (
  SELECT 1 FROM public.fisioterapeutas f WHERE lower(f.email) = lower(v.email)
);

-- Agendamentos de demonstração (somente se a tabela estiver vazia)
INSERT INTO public.agendamentos (paciente_id, fisioterapeuta_id, inicio, duracao_min, servico, status, canal_origem)
SELECT p.id, f.id, slot.inicio, 50, 'Fisioterapia', slot.status::public.status_agendamento, 'seed'
FROM (
  VALUES
    ('adrianolimacezar@gmail.com', 0, '2026-07-07 09:00:00-03', 'confirmado'),
    ('lacerdabrenda21@gmail.com', 1, '2026-07-07 10:00:00-03', 'agendado'),
    ('fisiocamilap@gmail.com', 2, '2026-07-07 11:00:00-03', 'agendado'),
    ('adrianolimacezar@gmail.com', 3, '2026-07-08 09:00:00-03', 'confirmado'),
    ('moraes.cadu98@gmail.com', 4, '2026-07-08 14:00:00-03', 'agendado'),
    ('cbmoveneuro@gmail.com', 5, '2026-07-09 08:30:00-03', 'agendado'),
    ('danielemoraes2@gmail.com', 6, '2026-07-09 10:30:00-03', 'realizado'),
    ('diegoxavier.fisio@gmail.com', 7, '2026-07-09 15:00:00-03', 'agendado'),
    ('fernandapereira.fisioterapia@gmail.com', 8, '2026-07-10 09:00:00-03', 'confirmado'),
    ('gabrielarrosi@gmail.com', 9, '2026-07-10 11:00:00-03', 'agendado')
) AS slot(fisio_email, paciente_idx, inicio, status)
JOIN public.fisioterapeutas f ON lower(f.email) = lower(slot.fisio_email)
JOIN LATERAL (
  SELECT id FROM public.pacientes WHERE ativo IS NOT FALSE ORDER BY nome LIMIT 1 OFFSET slot.paciente_idx
) p ON true
WHERE (SELECT count(*)::int FROM public.agendamentos) = 0
  AND (SELECT count(*)::int FROM public.pacientes) > 9
  AND (SELECT count(*)::int FROM public.fisioterapeutas) >= 10;
