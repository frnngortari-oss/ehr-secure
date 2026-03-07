import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SearchParams> };

export default async function PatientsSearchRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    }
  }
  redirect(`/patients${query.toString() ? `?${query.toString()}` : ""}`);
}
