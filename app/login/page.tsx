import { login } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

type SearchParams = { error?: string };
type Props = { searchParams: Promise<SearchParams> };

export default async function LoginPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const params = await searchParams;
  if (user) redirect("/");

  return (
    <div className="card" style={{ maxWidth: 460, margin: "40px auto" }}>
      <h2 style={{ marginTop: 0 }}>Ingresar</h2>
      <p className="small">Acceso por rol: admin, recepcion o profesionales clinicos.</p>
      {params.error === "cred" ? (
        <p className="small" style={{ color: "#b3261e" }}>
          Usuario o contrasena incorrectos.
        </p>
      ) : null}
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
