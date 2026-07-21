-- Cron diário: emissão NF em data específica (modo data_especifica)

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
    raise exception 'CRON_SECRET não encontrado em integracao_config';
  end if;

  if exists (select 1 from cron.job where jobname = 'nf-emissao-data-especifica') then
    perform cron.unschedule('nf-emissao-data-especifica');
  end if;

  perform cron.schedule(
    'nf-emissao-data-especifica',
    '0 8 * * *',
    format(
      $job$
      select net.http_post(
        url := 'https://%s.supabase.co/functions/v1/nf-emissao-data-especifica',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L),
        body := '{}'::jsonb
      );
      $job$,
      'grlkbtnwvxorlfglyzid',
      v_cron_secret
    )
  );
end $$;
