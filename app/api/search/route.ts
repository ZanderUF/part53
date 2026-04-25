import { NextRequest, NextResponse } from "next/server";
import { searchParagraphs } from "@/db/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const hits = searchParagraphs(q, 25);
  return NextResponse.json({ hits });
}
