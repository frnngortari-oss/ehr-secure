import "./globals.css";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import SidebarNav from "@/components/sidebar-nav";

export const metadata = {
  title: "EHR Secure",
  description: "Sistema base de historias clinicas"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="es">
      <body>
        <div className={user ? "app-shell with-sidebar" : "app-shell"}>
          {user ? <input id="sidebar-toggle" className="sidebar-toggle-input" type="checkbox" /> : null}
          {user ? (
            <aside className="app-sidebar">
              <div className="brand-block">
                <h1>EHR Secure</h1>
                <p className="small">{user.fullName}</p>
                <p className="small">Rol: {user.role}</p>
              </div>
              <SidebarNav role={user.role} />
            </aside>
          ) : null}

          <div className="app-main">
            <header className="topbar">
              <div className="row">
                {user ? (
                  <label htmlFor="sidebar-toggle" className="sidebar-toggle-btn" title="Mostrar/ocultar menu">
                    Menu
                  </label>
                ) : null}
                <Link href="/" className="brand-mobile">EHR Secure</Link>
              </div>
              {user ? (
                <form action={logout}>
                  <button style={{ width: "auto", padding: "6px 12px" }} type="submit">Salir</button>
                </form>
              ) : (
                <Link href="/login">Ingresar</Link>
              )}
            </header>
            <main className="page-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
