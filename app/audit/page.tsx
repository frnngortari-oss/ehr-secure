import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  await requireRole(["ADMIN"]);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: {
        select: { fullName: true, email: true, role: true }
      }
    }
  });

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Auditoria de cambios</h2>
      <p className="small">Ultimos 100 eventos.</p>
      {logs.length === 0 ? <p className="small">Sin eventos.</p> : null}
      {logs.map((log) => (
        <article key={log.id} className="card">
          <p className="small">{new Date(log.createdAt).toLocaleString("es-AR")}</p>
          <p><strong>Accion:</strong> {log.action}</p>
          <p><strong>Actor:</strong> {log.actor.fullName} ({log.actor.role}) - {log.actor.email}</p>
          <p><strong>Entidad:</strong> {log.entity} / {log.entityId}</p>
          {log.patientId ? <p><strong>Paciente:</strong> {log.patientId}</p> : null}
        </article>
      ))}
    </div>
  );
}
