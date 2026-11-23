ALTER TABLE "tw_users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "tw_users" ADD CONSTRAINT "tw_users_email_unique" UNIQUE("email");