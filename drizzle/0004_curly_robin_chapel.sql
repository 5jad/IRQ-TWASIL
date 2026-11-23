CREATE TABLE "tw_community_members" (
	"community_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_community_members_community_id_user_id_pk" PRIMARY KEY("community_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tw_community_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"channel" text DEFAULT 'general' NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sort_ts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text,
	"product_id" text NOT NULL,
	"price_iqd" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_saved_collection_items" (
	"collection_id" text NOT NULL,
	"post_id" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tw_saved_collection_items_collection_id_post_id_pk" PRIMARY KEY("collection_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "tw_saved_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tw_wallet_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount_coins" integer NOT NULL,
	"description" text NOT NULL,
	"related_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tw_comments" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "tw_communities" ADD COLUMN "creator_id" text;--> statement-breakpoint
ALTER TABLE "tw_communities" ADD COLUMN "category" text DEFAULT 'عام' NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_communities" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_products" ADD COLUMN "seller_id" text;--> statement-breakpoint
ALTER TABLE "tw_products" ADD COLUMN "category" text DEFAULT 'أخرى' NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "canvas_config_json" jsonb;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "settings_json" jsonb;--> statement-breakpoint
ALTER TABLE "tw_users" ADD COLUMN "wallet_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tw_community_members" ADD CONSTRAINT "tw_community_members_community_id_tw_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."tw_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_community_members" ADD CONSTRAINT "tw_community_members_user_id_tw_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_community_messages" ADD CONSTRAINT "tw_community_messages_community_id_tw_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."tw_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_community_messages" ADD CONSTRAINT "tw_community_messages_sender_id_tw_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_orders" ADD CONSTRAINT "tw_orders_buyer_id_tw_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_orders" ADD CONSTRAINT "tw_orders_seller_id_tw_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."tw_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_orders" ADD CONSTRAINT "tw_orders_product_id_tw_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."tw_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_saved_collection_items" ADD CONSTRAINT "tw_saved_collection_items_collection_id_tw_saved_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."tw_saved_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_saved_collection_items" ADD CONSTRAINT "tw_saved_collection_items_post_id_tw_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."tw_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_saved_collections" ADD CONSTRAINT "tw_saved_collections_user_id_tw_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_wallet_transactions" ADD CONSTRAINT "tw_wallet_transactions_user_id_tw_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_communities" ADD CONSTRAINT "tw_communities_creator_id_tw_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."tw_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tw_products" ADD CONSTRAINT "tw_products_seller_id_tw_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."tw_users"("id") ON DELETE cascade ON UPDATE no action;