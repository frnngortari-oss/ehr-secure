import { createUserByAdmin } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  ok?: string;
  error?: string;
};

type Props = { searchParams: Promise<SearchParams> };

export default async function AdminUsersPage({ searchParams }: Props) {
  await requireRole(["ADMIN"]);
  const params = await searchParams;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      medicalSpecialty: true,
      isActive: true,
      createdAt: true
    }
  });

  return (
    <div className="two-col">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Crear usuario</h2>
        {params.ok ? <p className="small" style={{ color: "#198754" }}>Usuario creado correctamente.</p> : null}
        {params.error === "exists" ? <p className="small" style={{ color: "#b3261e" }}>Ese usuario ya existe.</p> : null}
        {params.error === "invalid" ? <p className="small" style={{ color: "#b3261e" }}>Datos invalidos o especialidad faltante para medico.</p> : null}
        {params.error === "weakpass" ? <p className="small" style={{ color: "#b3261e" }}>La contrasena debe tener al menos 10 caracteres, mayuscula, minuscula, numero y simbolo.</p> : null}
        <form action={createUserByAdmin}>
          <div style={{ marginBottom: 8 }}>
            <label>Usuario (login)</label>
            <input name="email" required />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Nombre completo</label>
            <input name="fullName" required />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Rol</label>
            <select name="role" defaultValue="MEDICO">
              <option value="MEDICO">MEDICO</option>
              <option value="PSICOLOGO">PSICOLOGO</option>
              <option value="FONOAUDIOLOGO">FONOAUDIOLOGO</option>
              <option value="KINESIOLOGO">KINESIOLOGO</option>
              <option value="TERAPISTA_OCUPACIONAL">TERAPISTA OCUPACIONAL</option>
              <option value="RECEPCION">RECEPCION</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Especialidad medica (solo para MEDICO)</label>
            <input name="medicalSpecialty" placeholder="Ej: Clinica medica, Neurologia..." />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Contrasena</label>
            <input type="password" name="password" minLength={10} required />
          </div>
          <button type="submit">Crear usuario</button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Usuarios del sistema</h2>
        {users.length === 0 ? <p className="small">Sin usuarios.</p> : null}
        <div style={{ overflowX: "auto" }}>
          <table className="audit-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Especialidad</th>
                <th>Activo</th>
                <th>Alta</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.fullName}</td>
                  <td>{user.role}</td>
                  <td>{user.medicalSpecialty ?? "-"}</td>
                  <td>{user.isActive ? "Si" : "No"}</td>
                  <td>{new Date(user.createdAt).toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
