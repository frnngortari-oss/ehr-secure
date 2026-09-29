type Props = {
  healthInsurance?: string | null;
  memberNumber?: string | null;
  prefix?: string;
};

export default function PatientCoverageFields({ healthInsurance, memberNumber, prefix = "" }: Props) {
  const insuranceName = prefix ? `${prefix}HealthInsurance` : "healthInsurance";
  const memberName = prefix ? `${prefix}MemberNumber` : "memberNumber";

  return (
    <fieldset className="coverage-fields">
      <legend>Cobertura de salud</legend>
      <p className="small">Datos opcionales. Podes completarlos o actualizarlos mas adelante.</p>
      <div className="grid">
        <div>
          <label htmlFor={insuranceName}>Obra social / prepaga</label>
          <input id={insuranceName} name={insuranceName} defaultValue={healthInsurance ?? ""}
            maxLength={150} placeholder="Ej: PAMI, IOMA, OSDE" />
        </div>
        <div>
          <label htmlFor={memberName}>Numero de afiliado</label>
          <input id={memberName} name={memberName} defaultValue={memberNumber ?? ""}
            type="text" maxLength={80} placeholder="Tal como figura en la credencial" />
        </div>
      </div>
    </fieldset>
  );
}
