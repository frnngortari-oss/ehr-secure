import Link from "next/link";
import { createPatient } from "@/app/actions";
import { requireRole } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewPatientPage({ searchParams }: Props) {
  await requireRole(["ADMIN", "RECEPCION", "MEDICO"]);
  const params = await searchParams;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Alta de paciente</h2>
      {params.error === "dni" ? (
        <p className="small" style={{ color: "#b3261e" }}>
          Ya existe un paciente con ese DNI.
        </p>
      ) : null}
      <form action={createPatient}>
        <div className="grid">
          <div>
            <label>Nombre</label>
            <input name="firstName" required />
          </div>
          <div>
            <label>Apellido</label>
            <input name="lastName" required />
          </div>
          <div>
            <label>DNI</label>
            <input name="nationalId" required />
          </div>
          <div>
            <label>Fecha de nacimiento</label>
            <input type="date" name="birthDate" required />
          </div>
          <div>
            <label>Sexo</label>
            <select name="sex" defaultValue="F">
              <option value="F">F</option>
              <option value="M">M</option>
              <option value="X">X</option>
            </select>
          </div>
          <div>
            <label>Email</label>
            <input type="email" name="email" />
          </div>
          <div>
            <label>Telefono</label>
            <input name="phone" />
          </div>
          <div>
            <label>Direccion</label>
            <input name="address" />
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="submit">Guardar paciente</button>
          <Link href="/patients" className="small">Volver</Link>
        </div>
      </form>
    </div>
  );
}
