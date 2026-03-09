export default function OfflinePage() {
  return (
    <div className="card" style={{ maxWidth: 640, margin: "24px auto" }}>
      <h2 style={{ marginTop: 0 }}>Sin conexion</h2>
      <p className="small">
        La aplicacion esta instalada, pero para ver historias clinicas y sincronizar turnos necesitas internet.
      </p>
      <p className="small" style={{ marginBottom: 0 }}>
        Cuando recuperes conexion, actualiza la pantalla.
      </p>
    </div>
  );
}
