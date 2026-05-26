import { NextRequest, NextResponse } from "next/server";
import { listAllSectionXrefs, listSubparts } from "@/db/queries";
import { getRawDb } from "@/db/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const partNumber = req.nextUrl.searchParams.get("part") ?? undefined;
  const subparts = listSubparts(partNumber);
  const params: unknown[] = [];
  let partFilter = "";
  if (partNumber) {
    partFilter = "WHERE sp.part_number = ?";
    params.push(partNumber);
  }
  const sections = getRawDb()
    .prepare(
      `SELECT s.code, s.title, sp.code AS subpart_code, sp.part_number
       FROM sections s JOIN subparts sp ON sp.id = s.subpart_id ${partFilter} ORDER BY s.ordinal`,
    )
    .all(...params) as Array<{ code: string; title: string; subpart_code: string; part_number: string }>;
  const edges = listAllSectionXrefs(partNumber);
  return NextResponse.json({ subparts, sections, edges });
}
