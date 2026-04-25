import { NextResponse } from "next/server";
import { listAllSectionXrefs, listSubparts } from "@/db/queries";
import { getRawDb } from "@/db/client";

export const runtime = "nodejs";

export async function GET() {
  const subparts = listSubparts();
  const sections = getRawDb()
    .prepare(
      `SELECT s.code, s.title, sp.code AS subpart_code FROM sections s JOIN subparts sp ON sp.id = s.subpart_id ORDER BY s.ordinal`,
    )
    .all() as Array<{ code: string; title: string; subpart_code: string }>;
  const edges = listAllSectionXrefs();
  return NextResponse.json({ subparts, sections, edges });
}
