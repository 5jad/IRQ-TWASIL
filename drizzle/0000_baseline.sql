CREATE TABLE IF NOT EXISTS "tw_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"author_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" text NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"is_liked" boolean DEFAULT false NOT NULL,
	"sort_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tw_communities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"members_count" integer DEFAULT 1 NOT NULL,
	"province" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"sort_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tw_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"avatar_url" text NOT NULL,
	"last_message" text DEFAULT '' NOT NULL,
	"last_message_time" text NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"order_number" text,
	"sort_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tw_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"text" text NOT NULL,
	"timestamp" text NOT NULL,
	"is_own" boolean DEFAULT false NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"voice_duration" text,
	"reaction" text,
	"sort_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tw_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"kind" text NOT NULL,
	"target_text" text NOT NULL,
	"time" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"media_thumbnail_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tw_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"media_json" jsonb,
	"poll_json" jsonb,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"reposts_count" integer DEFAULT 0 NOT NULL,
	"is_liked" boolean DEFAULT false NOT NULL,
	"is_saved" boolean DEFAULT false NOT NULL,
	"tagged_products_json" jsonb,
	"created_at" text NOT NULL,
	"location" text,
	"audio_track" text,
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"sort_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tw_products" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"price_iqd" integer NOT NULL,
	"compare_at_price_iqd" integer,
	"shop_name" text NOT NULL,
	"shop_verified" boolean DEFAULT false NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"condition" text DEFAULT 'new' NOT NULL,
	"image_url" text NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"rating_avg" real DEFAULT 5 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"is_wishlisted" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tw_stories" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"media_url" text NOT NULL,
	"media_type" text DEFAULT 'image' NOT NULL,
	"caption" text,
	"sound_title" text,
	"duration_sec" integer DEFAULT 5 NOT NULL,
	"audience" text DEFAULT 'everyone' NOT NULL,
	"mode" text DEFAULT 'story' NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"expires_hint" text,
	"bg_gradient" text,
	"overlays_json" jsonb,
	"sort_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tw_users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text NOT NULL,
	"cover_url" text,
	"bio" text DEFAULT '' NOT NULL,
	"province" text DEFAULT 'بغداد' NOT NULL,
	"city" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_kind" text DEFAULT 'none' NOT NULL,
	"account_type" text DEFAULT 'personal' NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"followers_count" integer DEFAULT 0 NOT NULL,
	"following_count" integer DEFAULT 0 NOT NULL,
	"posts_count" integer DEFAULT 0 NOT NULL,
	"has_active_story" boolean DEFAULT false NOT NULL,
	"has_unseen_story" boolean DEFAULT false NOT NULL,
	"is_close_friend" boolean DEFAULT false NOT NULL,
	"is_following" boolean DEFAULT false NOT NULL,
	"is_followed_by" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tw_comments" ADD CONSTRAINT "tw_comments_post_id_tw_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."tw_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tw_comments" ADD CONSTRAINT "tw_comments_author_id_tw_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tw_messages" ADD CONSTRAINT "tw_messages_conversation_id_tw_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."tw_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tw_notifications" ADD CONSTRAINT "tw_notifications_actor_id_tw_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tw_posts" ADD CONSTRAINT "tw_posts_author_id_tw_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tw_stories" ADD CONSTRAINT "tw_stories_author_id_tw_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;