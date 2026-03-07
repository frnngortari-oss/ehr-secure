import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  q?: string;
  action?: string;
};

type Props = {
  searchParams: Promise<SearchParams>;
};

function compactJson(value: unknown) {
  if (value === null || value === undefined) return "-";
  try {
    const text = JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  } catch {
    return String(value);
  }
}

export default async function AuditPage({ searchParams }: Props) {
  await requireRole(["ADMIN"]);
  const params = await searchParams;

  const logs = await prisma.auditLog.findMany({
    where: {
      action: params.action ? { contains: params.action, mode: "insensitive" } : undefined,
      OR: params.q
        ? [
            { entity: { contains: params.q, mode: "insensitive" } },
            { entityId: { contains: params.q } },
            { actor: { fullName: { contains: params.q, mode: "insensitive" } } }
          ]
        : undefined
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      actor: {
        select: { fullName: true, email: true, role: true }
      }
    }
  });

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Auditoria del sitio</h2>
      <p className="small">Ultimos 300 eventos (altas, ediciones, login/logout, turnos, etc.).</p>
      <form method="GET" className="row" style={{ marginBottom: 12 }}>
        <input name="q" placeholder="Entidad, ID o actor" defaultValue={params.q ?? ""} />
        <input name="action" placeholder="Accion (ej: UPDATE_ENCOUNTER)" defaultValue={params.action ?? ""} />
        <button type="submit" style={{ width: "auto" }}>Filtrar</button>
      </form>
      {logs.length === 0 ? <p className="small">Sin eventos.</p> : null}
      <div style={{ overflowX: "auto" }}>
        <table className="audit-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Actor</th>
              <th>Accion</th>
              <th>Entidad</th>
              <th>ID Entidad</th>
              <th>Paciente</th>
              <th>Antes</th>
              <th>Despues</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString("es-AR")}</td>
                <td>{log.actor.fullName} ({log.actor.role})</td>
                <td>{log.action}</td>
                <td>{log.entity}</td>
                <td>{log.entityId}</td>
                <td>{log.patientId ?? "-"}</td>
                <td className="small">{compactJson(log.before)}</td>
                <td className="small">{compactJson(log.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
