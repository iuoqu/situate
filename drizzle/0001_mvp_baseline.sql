CREATE TYPE "public"."edition_status" AS ENUM('planning', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."moderation_decision" AS ENUM('approve', 'reject', 'request_changes', 'flag_for_legal');--> statement-breakpoint
CREATE TYPE "public"."moderation_layer" AS ENUM('ai', 'human', 'legal');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('defamation', 'hate_speech', 'factual_error', 'copyright', 'harassment', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('draft', 'ai_review', 'human_review', 'published');--> statement-breakpoint
CREATE TYPE "public"."supported_language" AS ENUM('en', 'zh_CN', 'zh_TW', 'ja', 'ko');--> statement-breakpoint
CREATE TYPE "public"."translation_access_tier" AS ENUM('free', 'metered', 'premium');--> statement-breakpoint
CREATE TYPE "public"."translation_method" AS ENUM('original', 'ai', 'ai_post_edited', 'human');--> statement-breakpoint
CREATE TYPE "public"."translation_status" AS ENUM('draft', 'ai_generated', 'in_review', 'published');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "block_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"language" "supported_language" NOT NULL,
	"method" "translation_method" NOT NULL,
	"status" "translation_status" DEFAULT 'draft' NOT NULL,
	"content" text NOT NULL,
	"annotations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"translator_id" text,
	"access_tier" "translation_access_tier" DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"theme" text,
	"editors_letter" text,
	"cover_image_url" text,
	"publish_at" timestamp with time zone,
	"status" "edition_status" DEFAULT 'planning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editions_publish_ready" CHECK ("editions"."status" IN ('planning', 'archived')
        OR (
          "editions"."editors_letter" IS NOT NULL
          AND "editions"."cover_image_url" IS NOT NULL
          AND "editions"."publish_at" IS NOT NULL
        ))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editorial_principles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"version" text NOT NULL,
	"title_i18n" jsonb NOT NULL,
	"body_i18n" jsonb NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_by" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moderation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"layer" "moderation_layer" NOT NULL,
	"reviewer_id" text,
	"decision" "moderation_decision" NOT NULL,
	"rationale" text,
	"flagged_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cited_principles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "narrative_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"event_date" timestamp with time zone,
	"location" geometry(point),
	"sequence_number" serial NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"reporter_id" text,
	"category" "report_category" NOT NULL,
	"body" text,
	"locale" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolver_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"title" text,
	"abstract" text,
	"source_language" "supported_language" DEFAULT 'en' NOT NULL,
	"status" "status" DEFAULT 'draft' NOT NULL,
	"edition_id" uuid,
	"position_in_edition" integer,
	"content_flags" jsonb DEFAULT '{"realPlaces":[],"realPersons":[],"realOrgs":[],"conflictZone":false}'::jsonb NOT NULL,
	"author_affiliations" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"satire_disclosure" boolean DEFAULT false NOT NULL,
	"sensitivity_warnings" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_position_requires_edition" CHECK ("submissions"."edition_id" IS NULL OR "submissions"."position_in_edition" IS NOT NULL)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "block_translations" ADD CONSTRAINT "block_translations_block_id_narrative_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."narrative_blocks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "narrative_blocks" ADD CONSTRAINT "narrative_blocks_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "block_translations_block_lang_method_idx" ON "block_translations" USING btree ("block_id","language","method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "block_translations_block_lang_idx" ON "block_translations" USING btree ("block_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "editions_slug_idx" ON "editions" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "editions_number_idx" ON "editions" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editions_publish_at_idx" ON "editions" USING btree ("publish_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editions_status_idx" ON "editions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_principles_code_version_idx" ON "editorial_principles" USING btree ("code","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "editorial_principles_active_idx" ON "editorial_principles" USING btree ("code") WHERE "editorial_principles"."superseded_by" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moderation_decisions_submission_id_idx" ON "moderation_decisions" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moderation_decisions_layer_idx" ON "moderation_decisions" USING btree ("layer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "narrative_blocks_location_gist_idx" ON "narrative_blocks" USING gist ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "narrative_blocks_submission_id_idx" ON "narrative_blocks" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_submission_id_idx" ON "reports" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_locale_idx" ON "reports" USING btree ("locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submissions_edition_id_idx" ON "submissions" USING btree ("edition_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "submissions_edition_position_idx" ON "submissions" USING btree ("edition_id","position_in_edition") WHERE "submissions"."edition_id" IS NOT NULL;