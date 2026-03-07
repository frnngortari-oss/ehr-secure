import { requireRole } from "@/lib/auth";

export default async function BackupAdminPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Backup de base de datos</h2>
      <p className="small">
        Descarga una copia completa en formato JSON. Solo disponible para ADMIN.
      </p>
      <a href="/api/admin/backup">
        <button type="button" style={{ width: "auto" }}>Descargar backup</button>
      </a>
    </div>
  );
}
