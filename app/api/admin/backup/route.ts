import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { exportBackupPayload } from "@/lib/backup";

export const dynamic = "force-dynamic";

function toSheetRows<T extends Record<string, unknown>>(rows: T[]) {
  if (rows.length === 0) {
    return [{ info: "Sin datos" }];
  }
  return rows;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const payload = await exportBackupPayload();
  const stamp = payload.exportedAt.replace(/[:.]/g, "-");
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();

  if (format === "json") {
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ehr-backup-${stamp}.json"`
      }
    });
  }

  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      exportedAt: payload.exportedAt,
      version: payload.version,
      users: payload.data.users.length,
      patients: payload.data.patients.length,
      problems: payload.data.problems.length,
      appointments: payload.data.appointments.length,
      encounters: payload.data.encounters.length,
      documents: payload.data.documents.length,
      auditLogs: payload.data.auditLogs.length
    }
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toSheetRows(payload.data.users)), "Usuarios");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toSheetRows(payload.data.patients)), "Pacientes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toSheetRows(payload.data.problems)), "Problemas");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toSheetRows(payload.data.appointments)), "Turnos");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toSheetRows(payload.data.encounters)), "Evoluciones");

  const documentsRows = payload.data.documents.map((doc) => ({
    id: doc.id,
    patientId: doc.patientId,
    uploadedById: doc.uploadedById,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    category: doc.category,
    createdAt: doc.createdAt,
    contentBase64Preview: doc.contentBase64.slice(0, 1024),
    contentTruncated: doc.contentBase64.length > 1024
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toSheetRows(documentsRows)), "Documentos");

  const auditRows = payload.data.auditLogs.map((log) => ({
    ...log,
    before: log.before == null ? null : JSON.stringify(log.before),
    after: log.after == null ? null : JSON.stringify(log.after)
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toSheetRows(auditRows)), "Auditoria");

  const fileBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", compression: true }) as Buffer;
  const body = new Uint8Array(fileBuffer);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ehr-backup-${stamp}.xlsx"`
    }
  });
}
