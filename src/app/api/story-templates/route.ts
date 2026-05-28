import { NextResponse } from "next/server";

import { listVisibleTemplates } from "@/lib/templates/registry";

/**
 * GET /api/story-templates
 *
 * Returns the publicly visible templates. Year-1: just `situate-spine`.
 * The shape mirrors the registry so the client doesn't need to know
 * about internal-only templates we might be drafting offline.
 *
 * Public endpoint — picking a template doesn't reveal anything sensitive
 * and we want the EntryChoice page to render before login (so visitors
 * can preview what writing here looks like).
 */
export const runtime = "nodejs";

export async function GET() {
  const templates = listVisibleTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    sectionCount: t.sections.length,
  }));
  return NextResponse.json({ templates });
}
