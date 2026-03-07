import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!["ADMIN", "RECEPCION", "MEDICO"].includes(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "25", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 25;

  if (q.length < 2) {
    return NextResponse.json({ patients: [] });
  }

  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { nationalId: { contains: q } }
      ]
    },
    select: { id: true, firstName: true, lastName: true, nationalId: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: limit
  });

  return NextResponse.json({ patients });
}
