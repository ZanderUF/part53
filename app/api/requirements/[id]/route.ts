import { NextRequest, NextResponse } from "next/server";
import { setRequirementStatus } from "@/db/notes";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { status: string };
  setRequirementStatus(Number(id), body.status);
  return NextResponse.json({ ok: true });
}
