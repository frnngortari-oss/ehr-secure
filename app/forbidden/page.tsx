import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function ForbiddenPage() {
  await requireUser();

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Acceso denegado</h2>
      <p>No tenes permisos para esta operacion.</p>
      <Link href="/">Volver al inicio</Link>
    </div>
  );
}
