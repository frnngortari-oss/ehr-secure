"use client";

import { useEffect, useMemo, useState } from "react";
import { createEncounter } from "@/app/actions";

type ProblemOption = {
  id: string;
  title: string;
};

type Props = {
  patientId: string;
  problems: ProblemOption[];
};

type EvolutionDraft = {
  problemId: string;
  reason: string;
  newProblemTitle: string;
  newProblemCategory: string;
  content: string;
  plan: string;
};

const EMPTY_DRAFT: EvolutionDraft = {
  problemId: "",
  reason: "",
  newProblemTitle: "",
  newProblemCategory: "Problema",
  content: "",
  plan: ""
};

export default function EvolutionComposeDrawer({ patientId, problems }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [draft, setDraft] = useState<EvolutionDraft>(EMPTY_DRAFT);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastSavedText, setLastSavedText] = useState("");

  const storageKey = useMemo(() => `hcv_evolution_draft_${patientId}`, [patientId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setIsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as { draft?: EvolutionDraft; savedAt?: string };
      if (parsed.draft) setDraft({ ...EMPTY_DRAFT, ...parsed.draft });
      if (parsed.savedAt) {
        const savedDate = new Date(parsed.savedAt);
        if (!Number.isNaN(savedDate.getTime())) {
          setLastSavedText(savedDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
        }
      }
    } catch {
      // keep defaults if parsing fails
    } finally {
      setIsHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(storageKey, JSON.stringify({ draft, savedAt }));
      const savedDate = new Date(savedAt);
      setLastSavedText(savedDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draft, isHydrated, storageKey]);

  const hasDraftData =
    draft.problemId.trim().length > 0 ||
    draft.reason.trim().length > 0 ||
    draft.newProblemTitle.trim().length > 0 ||
    draft.content.trim().length > 0 ||
    draft.plan.trim().length > 0;

  function clearDraft() {
    setDraft(EMPTY_DRAFT);
    setLastSavedText("");
    window.localStorage.removeItem(storageKey);
  }

  return (
    <>
      <button
        type="button"
        className="compose-drawer-toggle"
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
      >
        {hasDraftData ? "Nueva evolucion (borrador)" : "Nueva evolucion"}
      </button>

      {isOpen ? (
        <aside className={isMinimized ? "evo-compose-drawer minimized" : "evo-compose-drawer"} aria-label="Nueva evolucion">
          {isMinimized ? (
            <div className="evo-compose-mini">
              <strong>Nueva evolucion</strong>
              <p className="small" style={{ margin: "4px 0 8px" }}>
                {lastSavedText ? `Borrador guardado ${lastSavedText}` : "Borrador activo"}
              </p>
              <div className="row">
                <button type="button" style={{ width: "auto", padding: "6px 10px" }} onClick={() => setIsMinimized(false)}>
                  Restaurar
                </button>
                <button type="button" style={{ width: "auto", padding: "6px 10px", background: "#556a84" }} onClick={() => setIsOpen(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="evo-compose-head">
                <h4 style={{ margin: 0 }}>Nueva evolucion</h4>
                <div className="row">
                  <button type="button" style={{ width: "auto", padding: "6px 10px", background: "#4d627d" }} onClick={clearDraft}>
                    Limpiar borrador
                  </button>
                  <button type="button" style={{ width: "auto", padding: "6px 10px", background: "#556a84" }} onClick={() => setIsMinimized(true)}>
                    Minimizar
                  </button>
                  <button type="button" style={{ width: "auto", padding: "6px 10px" }} onClick={() => setIsOpen(false)}>
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="evo-compose-body">
                <p className="small" style={{ marginTop: 0 }}>
                  Fecha y hora: automatica al guardar. {lastSavedText ? `Borrador guardado ${lastSavedText}.` : ""}
                </p>
                <form action={createEncounter}>
                  <input type="hidden" name="patientId" value={patientId} />
                  <div style={{ marginBottom: 8 }}>
                    <label>Problema asociado</label>
                    <select
                      name="problemId"
                      value={draft.problemId}
                      onChange={(event) => setDraft((prev) => ({ ...prev, problemId: event.target.value }))}
                    >
                      <option value="">Sin asociar</option>
                      {problems.map((problem) => (
                        <option key={problem.id} value={problem.id}>{problem.title}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label>Motivo de consulta (opcional)</label>
                    <input
                      name="reason"
                      value={draft.reason}
                      onChange={(event) => setDraft((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="Si lo dejas vacio se guarda como 'Evolucion clinica'"
                    />
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label>Problema nuevo (si no existe en la lista)</label>
                    <input
                      name="newProblemTitle"
                      value={draft.newProblemTitle}
                      onChange={(event) => setDraft((prev) => ({ ...prev, newProblemTitle: event.target.value }))}
                      placeholder="Ej: Cefalea cronica"
                    />
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label>Categoria del problema nuevo</label>
                    <input
                      name="newProblemCategory"
                      value={draft.newProblemCategory}
                      onChange={(event) => setDraft((prev) => ({ ...prev, newProblemCategory: event.target.value }))}
                    />
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label>Texto libre de evolucion</label>
                    <textarea
                      name="content"
                      rows={10}
                      value={draft.content}
                      onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
                      placeholder="Ingrese aqui la evolucion..."
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label>Plan (opcional)</label>
                    <textarea
                      name="plan"
                      rows={4}
                      value={draft.plan}
                      onChange={(event) => setDraft((prev) => ({ ...prev, plan: event.target.value }))}
                      placeholder="Si lo dejas vacio se guarda como 'Sin plan consignado'"
                    />
                  </div>

                  <button type="submit">Guardar evolucion</button>
                </form>
              </div>
            </>
          )}
        </aside>
      ) : null}
    </>
  );
}
