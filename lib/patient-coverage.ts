import { z } from "zod";

export const coverageSchema = z.object({
  healthInsurance: z.string().trim().max(150).nullish(),
  // Keep identifiers as text: leading zeroes, slashes and letters are meaningful.
  memberNumber: z.string().trim().max(80).nullish()
});

export function coverageFromForm(formData: FormData, prefix = "") {
  return {
    healthInsurance: formData.get(prefix ? `${prefix}HealthInsurance` : "healthInsurance"),
    memberNumber: formData.get(prefix ? `${prefix}MemberNumber` : "memberNumber")
  };
}

export function coverageData(value: z.infer<typeof coverageSchema>) {
  return {
    healthInsurance: value.healthInsurance || null,
    memberNumber: value.memberNumber || null
  };
}
