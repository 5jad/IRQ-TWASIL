ALTER TABLE "tw_posts" ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'everyone' NOT NULL;
