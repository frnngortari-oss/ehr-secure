import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportBackupPayload } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const payload = await exportBackupPayload();
  const stamp = payload.exportedAt.replace(/[:.]/g, "-");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ehr-backup-${stamp}.json"`
    }
  });
}
