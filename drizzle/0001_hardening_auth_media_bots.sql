CREATE TABLE "tw_blocks" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "tw_bot_chat_state" (
	"bot_id" text NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"started_at" timestamp,
	"blocked_at" timestamp,
	"wizard_state_json" jsonb,
	CONSTRAINT "tw_bot_chat_state_bot_id_user_id_pk" PRIMARY KEY("bot_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tw_bot_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"command" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_bot_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"bot_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tw_bot_updates" (
	"update_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tw_bot_updates_update_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bot_id" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"acked_at" timestamp,
	"delivered_at" timestamp,
	"next_retry_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_bot_webhooks" (
	"bot_id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"secret_token_hash" text,
	"secret_token_enc" text,
	"allowed_updates_json" jsonb,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_error_at" timestamp,
	"disabled_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_close_friends" (
	"owner_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_close_friends_owner_id_friend_id_pk" PRIMARY KEY("owner_id","friend_id")
);
--> statement-breakpoint
CREATE TABLE "tw_conversation_members" (
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tw_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tw_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"recipient_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_follows" (
	"follower_id" text NOT NULL,
	"followee_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id")
);
--> statement-breakpoint
CREATE TABLE "tw_media_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tw_media" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"staging_key" text NOT NULL,
	"public_key" text,
	"thumb_key" text,
	"public_url" text,
	"thumb_url" text,
	"mime" text NOT NULL,
	"declared_size_bytes" integer NOT NULL,
	"actual_size_bytes" integer,
	"sha256" text,
	"width" integer,
	"height" integer,
	"duration_sec" real,
	"blurhash" text,
	"used_by_type" text,
	"used_by_id" text,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_otp_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"phone_hmac" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"ip_address" text,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"invalidated_at" timestamp,
	"failed_challenge_counted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_reactions" (
	"user_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"value" text DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_reactions_user_id_target_type_target_id_pk" PRIMARY KEY("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "tw_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"device_label" text DEFAULT 'متصفح ويب' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_rotated_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"absolute_expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "tw_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tw_social_moments" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"author_id" text NOT NULL,
	"text" text,
	"media_id" text,
	"media_url" text,
	"media_type" text,
	"sound_id" text,
	"audience" text DEFAULT 'everyone' NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"sort_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_story_views" (
	"story_id" text NOT NULL,
	"viewer_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_story_views_story_id_viewer_id_pk" PRIMARY KEY("story_id","viewer_id")
);
--> statement-breakpoint
ALTER TABLE "tw_conversations" ADD COLUMN "direct_key" text;--> statement-breakpoint
ALTER TABLE "tw_messages" ADD COLUMN "client_msg_id" text;--> statement-breakpoint
ALTER TABLE "tw_messages" ADD COLUMN "media_id" text;--> statement-breakpoint
ALTER TABLE "tw_messages" ADD COLUMN "media_url" text;--> statement-breakpoint
ALTER TABLE "tw_messages" ADD COLUMN "reply_markup_json" jsonb;--> statement-breakpoint
ALTER TABLE "tw_messages" ADD COLUMN "reply_to_message_id" text;--> statement-breakpoint
ALTER TABLE "tw_messages" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "tw_messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tw_notifications" ADD COLUMN "recipient_id" text;--> statement-breakpoint
ALTER TABLE "tw_posts" ADD COLUMN "media_id" text;--> statement-breakpoint
ALTER TABLE "tw_stories" ADD COLUMN "media_id" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "handle_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "phone_enc" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "phone_hmac" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "phone_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "kind" text DEFAULT 'person' NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "last_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "bot_description" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "bot_short_description" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "bot_avatar_media_id" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "bot_privacy_mode" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "bot_can_join_groups" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "bot_is_listed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_blocks" ADD CONSTRAINT "tw_blocks_blocker_id_tw_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_blocks" ADD CONSTRAINT "tw_blocks_blocked_id_tw_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_bot_chat_state" ADD CONSTRAINT "tw_bot_chat_state_bot_id_tw_users_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_bot_chat_state" ADD CONSTRAINT "tw_bot_chat_state_user_id_tw_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_bot_commands" ADD CONSTRAINT "tw_bot_commands_bot_id_tw_users_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_bot_tokens" ADD CONSTRAINT "tw_bot_tokens_bot_id_tw_users_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_bot_updates" ADD CONSTRAINT "tw_bot_updates_bot_id_tw_users_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_bot_webhooks" ADD CONSTRAINT "tw_bot_webhooks_bot_id_tw_users_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_close_friends" ADD CONSTRAINT "tw_close_friends_owner_id_tw_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_close_friends" ADD CONSTRAINT "tw_close_friends_friend_id_tw_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_conversation_members" ADD CONSTRAINT "tw_conversation_members_conversation_id_tw_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."tw_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_conversation_members" ADD CONSTRAINT "tw_conversation_members_user_id_tw_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_follows" ADD CONSTRAINT "tw_follows_follower_id_tw_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_follows" ADD CONSTRAINT "tw_follows_followee_id_tw_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_media_jobs" ADD CONSTRAINT "tw_media_jobs_media_id_tw_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."tw_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_media" ADD CONSTRAINT "tw_media_owner_id_tw_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_reactions" ADD CONSTRAINT "tw_reactions_user_id_tw_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_reports" ADD CONSTRAINT "tw_reports_reporter_id_tw_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_sessions" ADD CONSTRAINT "tw_sessions_user_id_tw_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_social_moments" ADD CONSTRAINT "tw_social_moments_author_id_tw_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_story_views" ADD CONSTRAINT "tw_story_views_story_id_tw_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."tw_stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_story_views" ADD CONSTRAINT "tw_story_views_viewer_id_tw_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tw_bot_updates_bot_idx" ON "tw_bot_updates" USING btree ("bot_id","update_id");--> statement-breakpoint
CREATE INDEX "tw_events_recipient_idx" ON "tw_events" USING btree ("recipient_user_id","id");--> statement-breakpoint
CREATE INDEX "tw_media_owner_status_idx" ON "tw_media" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "tw_otp_phone_created_idx" ON "tw_otp_challenges" USING btree ("phone_hmac","created_at");--> statement-breakpoint
CREATE INDEX "tw_sessions_user_idx" ON "tw_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tw_messages_conv_client_msg_uidx" ON "tw_messages" USING btree ("conversation_id","sender_id","client_msg_id");--> statement-breakpoint
UPDATE "tw_users" SET "handle" = "username" WHERE "handle" IS NULL;--> statement-breakpoint
INSERT INTO "tw_follows" ("follower_id", "followee_id") SELECT 'u-me', "id" FROM "tw_users" WHERE "id" <> 'u-me' AND "is_following" = true AND EXISTS (SELECT 1 FROM "tw_users" WHERE "id" = 'u-me') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "tw_close_friends" ("owner_id", "friend_id") SELECT 'u-me', "id" FROM "tw_users" WHERE "id" <> 'u-me' AND "is_close_friend" = true AND EXISTS (SELECT 1 FROM "tw_users" WHERE "id" = 'u-me') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "tw_conversation_members" ("conversation_id", "user_id", "role", "unread_count") SELECT c."id", 'u-me', 'member', c."unread_count" FROM "tw_conversations" c WHERE EXISTS (SELECT 1 FROM "tw_users" WHERE "id" = 'u-me') ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "tw_users" DROP COLUMN "has_unseen_story";--> statement-breakpoint
ALTER TABLE "tw_users" DROP COLUMN "is_close_friend";--> statement-breakpoint
ALTER TABLE "tw_users" DROP COLUMN "is_following";--> statement-breakpoint
ALTER TABLE "tw_users" DROP COLUMN "is_followed_by";--> statement-breakpoint
ALTER TABLE "tw_conversations" ADD CONSTRAINT "tw_conversations_direct_key_unique" UNIQUE("direct_key");--> statement-breakpoint
ALTER TABLE "tw_users" ADD CONSTRAINT "tw_users_handle_unique" UNIQUE("handle");--> statement-breakpoint
ALTER TABLE "tw_users" ADD CONSTRAINT "tw_users_phone_hmac_unique" UNIQUE("phone_hmac");