import { importBackup } from "@/app/actions";
import { requireRole } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  const map: Record<string, string> = {
    confirm: "Debes escribir REEMPLAZAR para confirmar importacion.",
    file: "Debes seleccionar un archivo de backup.",
    json: "El archivo no tiene formato JSON valido."
  };
  return <p className="small" style={{ color: "#b3261e" }}>{map[error] ?? "Error desconocido."}</p>;
}

export default async function OfflineAdminPage({ searchParams }: Props) {
  await requireRole(["ADMIN"]);
  const params = await searchParams;

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Backups</h2>
        <p className="small">
          Descarga una copia completa de la base para restaurar localmente sin internet.
        </p>
        <a href="/api/admin/backup">
          <button type="button">Descargar backup JSON</button>
        </a>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Importar backup</h2>
        <p className="small">
          Esta accion reemplaza todo el contenido actual de la base de datos.
        </p>
        {params.ok === "imported" ? <p className="small" style={{ color: "#198754" }}>Backup importado correctamente.</p> : null}
        <ErrorMessage error={params.error} />
        <form action={importBackup}>
          <div style={{ marginBottom: 8 }}>
            <label>Archivo</label>
            <input type="file" name="backupFile" accept="application/json" required />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Confirmacion</label>
            <input
              name="confirmation"
              placeholder='Escribe REEMPLAZAR'
              required
            />
          </div>
          <button type="submit">Importar backup</button>
        </form>
      </section>

      <section className="card" style={{ gridColumn: "1 / -1" }}>
        <h3 style={{ marginTop: 0 }}>Sincronizacion Neon a local</h3>
        <p className="small">
          Usa los scripts incluidos para copiar Neon a PostgreSQL local y ejecutar la app en modo offline.
        </p>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
{`1) Configura LOCAL_DATABASE_URL en .env
2) npm run offline:sync
3) npm run offline:dev`}
        </pre>
      </section>
    </div>
  );
}
