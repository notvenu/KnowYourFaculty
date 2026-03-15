-- Replace the placeholders before running this in the Supabase SQL editor.
-- Example function URL:
-- https://<project-ref>.supabase.co/functions/v1/weekly-scrape

select
  cron.schedule(
    'weekly-faculty-scrape',
    '0 3 * * 1',
    $$
    select
      net.http_post(
        url := 'https://gdzjztvinvrgpobrqybp.supabase.co/functions/v1/weekly-scrape',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', 'e44cad5ad74f4d2e98e5fcb59e49b5347a1cb12b8e85434ca63fd9b68d23408a'
        ),
        body := jsonb_build_object('source', 'pg_cron')
      ) as request_id;
    $$
  );

-- To remove the schedule later:
-- select cron.unschedule('weekly-faculty-scrape');
