import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { storyDrafts, type DriveType, type TruthDeclaration } from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/write/start-project
 *
 * Path B entry point. Creates a new story_drafts row pre-marked as a
 * guided project (drive_type set, map_data/act_data initialised empty),
 * then redirects to /write/project/[id]/map where Phase 0 + Phase 1 live.
 *
 * Body (JSON):
 *   drive_type          DriveType   required
 *   truth_status        string      required  "real" | "fiction" | "blend"
 *   has_real_persons    boolean     required
 *   place_is_public     boolean     required
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/auth/login?reason=auth_required&next=/write", req.url),
      { status: 303 },
    );
  }

  let driveType: DriveType = "unknown";
  let truthDeclaration: TruthDeclaration = {
    status: null,
    has_real_persons: null,
    place_is_public: null,
  };

  try {
    const body = await req.json() as Record<string, unknown>;
    const validDriveTypes: DriveType[] = [
      "purposive_art", "purposive_commercial", "haunting", "unknown",
    ];
    if (typeof body.drive_type === "string" && validDriveTypes.includes(body.drive_type as DriveType)) {
      driveType = body.drive_type as DriveType;
    }
    const validStatuses = ["real", "fiction", "blend"];
    truthDeclaration = {
      status: typeof body.truth_status === "string" && validStatuses.includes(body.truth_status)
        ? body.truth_status as TruthDeclaration["status"]
        : null,
      has_real_persons: typeof body.has_real_persons === "boolean" ? body.has_real_persons : null,
      place_is_public: typeof body.place_is_public === "boolean" ? body.place_is_public : null,
    };
  } catch {
    // Keep defaults — user can update on the map page.
  }

  const [row] = await db
    .insert(storyDrafts)
    .values({
      userId: user.id,
      stage: "editing",
      driveType,
      truthDeclaration: truthDeclaration as unknown as object,
      mapData: { phase: "material" } as unknown as object,
      actData: { phase: "time" } as unknown as object,
    })
    .returning({ id: storyDrafts.id });

  return NextResponse.redirect(
    new URL(`/write/project/${row.id}/map`, req.url),
    { status: 303 },
  );
}
