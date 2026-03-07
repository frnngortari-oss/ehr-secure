import "./globals.css";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions";

export const metadata = {
  title: "EHR Secure",
  description: "Sistema base de historias clinicas"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="es">
      <body>
        <main>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h1 style={{ margin: 0 }}>EHR Secure</h1>
            <nav className="row" style={{ gap: 16 }}>
              {user ? (
                <>
                  <Link href="/">Inicio</Link>
                  <Link href="/patients">Pacientes</Link>
                  <Link href="/patients/search">Busqueda</Link>
                  <Link href="/agenda">Agenda</Link>
                  <Link href="/evolutions">Evoluciones</Link>
                  {(user.role === "ADMIN" || user.role === "RECEPCION" || user.role === "MEDICO") && <Link href="/patients/new">Nuevo paciente</Link>}
                  {user.role === "ADMIN" && <Link href="/audit">Auditoria</Link>}
                  {user.role === "ADMIN" && <Link href="/admin/offline">Offline</Link>}
                  <span className="small">{user.fullName} ({user.role})</span>
                  <form action={logout}>
                    <button style={{ width: "auto", padding: "6px 10px" }} type="submit">Salir</button>
                  </form>
                </>
              ) : (
                <Link href="/login">Ingresar</Link>
              )}
            </nav>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
