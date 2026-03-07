import { login } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="card" style={{ maxWidth: 460, margin: "40px auto" }}>
      <h2 style={{ marginTop: 0 }}>Ingresar</h2>
      <p className="small">Acceso por rol: admin, medico o recepcion.</p>
      <form action={login}>
        <div style={{ marginBottom: 10 }}>
          <label>Usuario</label>
          <input name="username" type="text" required />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Contrasena</label>
          <input name="password" type="password" required />
        </div>
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
