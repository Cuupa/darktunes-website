CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'publish-scheduled-news',
  '* * * * *',
  $$
    UPDATE public.news_posts
    SET status = 'published', updated_at = NOW()
    WHERE status = 'scheduled'
      AND published_at <= NOW();
  $$
);
