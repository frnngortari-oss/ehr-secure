import { requireRole } from "@/lib/auth";

export default async function BackupAdminPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Backup de base de datos</h2>
      <p className="small">
        Descarga una copia completa en Excel (.xlsx). Solo disponible para ADMIN.
      </p>
      <div className="row">
        <a href="/api/admin/backup">
          <button type="button" style={{ width: "auto" }}>Descargar backup Excel</button>
        </a>
        <a href="/api/admin/backup?format=json">
          <button type="button" style={{ width: "auto", background: "#4b6078" }}>Descargar JSON</button>
        </a>
      </div>
    </div>
  );
}
