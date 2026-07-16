-- Agenda a verificação periódica de pagamentos Cora (cora-verificar-pagamentos) via pg_cron.
-- Roda a cada 15 min, chamando a Edge Function via pg_net com o header x-cron-secret
-- (mesmo secret usado por atualizar-cobrancas-vencidas, lido de integracao_config em runtime
-- pela própria function; aqui só precisamos do valor para autenticar a chamada HTTP).
--
-- Nota: o valor do secret é lido dinamicamente da tabela integracao_config no momento da
-- criação do job, para não hardcodar o segredo na migration.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_cron_secret text;
begin
  select valor into v_cron_secret
  from public.integracao_config
  where chave = 'CRON_SECRET';

  if v_cron_secret is null then
    raise exception 'CRON_SECRET não encontrado em integracao_config — configure antes de agendar o cron';
  end if;

  if exists (select 1 from cron.job where jobname = 'cora-verificar-pagamentos') then
    perform cron.unschedule('cora-verificar-pagamentos');
  end if;

  perform cron.schedule(
    'cora-verificar-pagamentos',
    '*/15 * * * *',
    format(
      $job$
      select net.http_post(
        url := 'https://%s.supabase.co/functions/v1/cora-verificar-pagamentos',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L),
        body := '{}'::jsonb
      );
      $job$,
      'grlkbtnwvxorlfglyzid',
      v_cron_secret
    )
  );
end $$;
