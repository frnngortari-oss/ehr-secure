import assert from "node:assert/strict";
import test from "node:test";
import { coverageData, coverageFromForm, coverageSchema } from "../lib/patient-coverage";
import { patientPage, patientSearchWhere } from "../lib/patient-search";

test("coverage keeps membership identifiers intact for creation, editing and quick entry", () => {
  for (const prefix of ["", "newPatient"]) {
    const form = new FormData();
    form.set(prefix ? `${prefix}HealthInsurance` : "healthInsurance", "  OSDE  ");
    form.set(prefix ? `${prefix}MemberNumber` : "memberNumber", "  001234/02-A  ");
    const values = coverageData(coverageSchema.parse(coverageFromForm(form, prefix)));
    assert.deepEqual(values, { healthInsurance: "OSDE", memberNumber: "001234/02-A" });
  }
});

test("coverage is optional and both fields can be cleared independently", () => {
  assert.deepEqual(coverageData(coverageSchema.parse(coverageFromForm(new FormData()))), {
    healthInsurance: null, memberNumber: null
  });
  assert.deepEqual(coverageData(coverageSchema.parse({ healthInsurance: "   ", memberNumber: "0001" })), {
    healthInsurance: null, memberNumber: "0001"
  });
  assert.deepEqual(coverageData(coverageSchema.parse({ healthInsurance: "PAMI", memberNumber: " " })), {
    healthInsurance: "PAMI", memberNumber: null
  });
});

test("invalid coverage values are rejected on the server", () => {
  for (const value of [
    { healthInsurance: "x".repeat(151) },
    { memberNumber: "x".repeat(81) },
    { memberNumber: 123 }
  ]) assert.equal(coverageSchema.safeParse(value).success, false);
});

test("patient search accepts a full name and a formatted DNI", () => {
  const names = patientSearchWhere(" Laura Gomez ");
  assert.equal(names.OR?.length, 3);
  assert.deepEqual(names.OR?.[2], { AND: ["Laura", "Gomez"].map(term => ({ OR: [
    { firstName: { contains: term, mode: "insensitive" } },
    { lastName: { contains: term, mode: "insensitive" } }
  ] })) });
  assert.deepEqual(patientSearchWhere("30.111.222").OR?.[2], { nationalId: { contains: "30111222" } });
  assert.deepEqual(patientSearchWhere("  "), {});
});

test("pagination handles malformed URL values", () => {
  for (const value of [undefined, "", "abc", "0", "-1", "1.5", "Infinity"]) assert.equal(patientPage(value), 1);
  assert.equal(patientPage("2"), 2);
  assert.equal(patientPage("999999"), 100000);
});
