import type { Prisma } from "@prisma/client";

export function patientSearchWhere(query: string): Prisma.PatientWhereInput {
  const q = query.trim();
  if (!q) return {};
  const terms = q.split(/\s+/).filter(Boolean);
  const digits = q.replace(/\D/g, "");
  const filters: Prisma.PatientWhereInput[] = [
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } }
  ];
  if (digits) filters.push({ nationalId: { contains: digits } });
  if (terms.length > 1) {
    filters.push({ AND: terms.map((term) => ({ OR: [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } }
    ] })) });
  }
  return { OR: filters };
}

export function patientPage(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
}
