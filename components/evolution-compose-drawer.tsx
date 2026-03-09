"use client";

import { useState } from "react";
import { createEncounter } from "@/app/actions";

type ProblemOption = {
  id: string;
  title: string;
};

type Props = {
  patientId: string;
  problems: ProblemOption[];
};

export default function EvolutionComposeDrawer({ patientId, problems }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" className="compose-drawer-toggle" onClick={() => setIsOpen(true)}>
        Nueva evolucion
      </button>

      {isOpen ? (
        <aside className="evo-compose-drawer" aria-label="Nueva evolucion">
          <div className="evo-compose-head">
            <h4 style={{ margin: 0 }}>Nueva evolucion</h4>
            <button type="button" style={{ width: "auto", padding: "6px 10px" }} onClick={() => setIsOpen(false)}>
              Cerrar
            </button>
          </div>

          <div className="evo-compose-body">
            <p className="small" style={{ marginTop: 0 }}>
              Fecha y hora: automatica al guardar.
            </p>
            <form action={createEncounter}>
              <input type="hidden" name="patientId" value={patientId} />
              <div style={{ marginBottom: 8 }}>
                <label>Problema asociado</label>
                <select name="problemId" defaultValue="">
                  <option value="">Sin asociar</option>
                  {problems.map((problem) => (
                    <option key={problem.id} value={problem.id}>{problem.title}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label>Motivo de consulta (opcional)</label>
                <input name="reason" placeholder="Si lo dejas vacio se guarda como 'Evolucion clinica'" />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label>Problema nuevo (si no existe en la lista)</label>
                <input name="newProblemTitle" placeholder="Ej: Cefalea cronica" />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label>Categoria del problema nuevo</label>
                <input name="newProblemCategory" defaultValue="Problema" />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label>Texto libre de evolucion</label>
                <textarea name="content" rows={10} placeholder="Ingrese aqui la evolucion..." />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Plan (opcional)</label>
                <textarea name="plan" rows={4} placeholder="Si lo dejas vacio se guarda como 'Sin plan consignado'" />
              </div>

              <button type="submit">Guardar evolucion</button>
            </form>
          </div>
        </aside>
      ) : null}
    </>
  );
}
