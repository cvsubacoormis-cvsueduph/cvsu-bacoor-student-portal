import { describe, expect, it } from "vitest";
import {
  resolveSignatory,
  resolveDefaultSignatory,
} from "@/lib/cog-pdf";

/**
 * The signature block is the part of a COG a reader trusts, so who ends up on
 * it is worth pinning down explicitly.
 *
 * Rule: `admin` and `registrar` sign as themselves; anyone else — including a
 * student generating their own copy — gets the registrar assigned to the
 * student's program. `registrar_staff` is excluded because it is not in
 * COG_GENERATION_ROLES and so cannot reach a COG surface at all.
 */
describe("resolveSignatory", () => {
  const STAFF = { firstName: "Jane", lastName: "Reyes" };

  describe("staff sign as themselves", () => {
    it.each([
      ["admin", "Campus Registrar"],
      ["registrar", "Campus Registrar"],
    ])("uses the logged-in %s name", (role, expectedPosition) => {
      const result = resolveSignatory({
        role,
        ...STAFF,
        course: "BSIT",
      });

      expect(result.name).toBe("Jane Reyes");
      expect(result.position).toBe(expectedPosition);
    });

    it("signs as a registrar clerk when registrar_staff generates", () => {
      // COG_SIGNING_ROLES is derived from COG_GENERATION_ROLES, which includes
      // registrar_staff — they issue certificates too, so they sign their own
      // name with their own position.
      const result = resolveSignatory({
        role: "registrar_staff",
        ...STAFF,
        course: "BSIT",
      });

      expect(result.name).toBe("Jane Reyes");
      expect(result.position).toBe("Registrar Clerk");
    });

    it("does not use the course roster when a staff member is acting", () => {
      const result = resolveSignatory({
        role: "registrar",
        ...STAFF,
        // BSIT maps to "TENEE D. DADAP" — must NOT appear.
        course: "BSIT",
      });

      expect(result.name).not.toBe("TENEE D. DADAP");
      expect(result.name).toBe("Jane Reyes");
    });

    it("trims surrounding whitespace from the Clerk name parts", () => {
      const result = resolveSignatory({
        role: "registrar",
        firstName: "  Jane ",
        lastName: " Reyes  ",
        course: "BSIT",
      });

      expect(result.name).toBe("Jane Reyes");
    });
  });

  describe("fallback to the program's registrar", () => {
    it.each([["student"], ["faculty"], ["csg"], [undefined], [null], [""]])(
      "ignores the acting user for role %s",
      (role) => {
        const result = resolveSignatory({
          role: role as string | undefined,
          // A student's own name must never land on the signature line.
          firstName: "John",
          lastName: "Doe",
          course: "BSIT",
        });

        expect(result).toEqual(resolveDefaultSignatory("BSIT"));
        expect(result.name).not.toBe("John Doe");
      },
    );

    it("falls back when a staff account has no name on file", () => {
      const result = resolveSignatory({
        role: "registrar",
        firstName: "",
        lastName: null,
        course: "BSIT",
      });

      // Better the assigned registrar than a blank signature line.
      expect(result).toEqual(resolveDefaultSignatory("BSIT"));
      expect(result.name).not.toBe("");
    });

    it("uses only the available name part when one is missing", () => {
      const lastNameOnly = resolveSignatory({
        role: "registrar",
        firstName: null,
        lastName: "Reyes",
        course: "BSIT",
      });
      expect(lastNameOnly.name).toBe("Reyes");

      const firstNameOnly = resolveSignatory({
        role: "registrar",
        firstName: "Jane",
        lastName: undefined,
        course: "BSIT",
      });
      expect(firstNameOnly.name).toBe("Jane");
    });
  });

  describe("resolveDefaultSignatory", () => {
    it.each([
      ["BSIT", "TENEE D. DADAP", "Registrar Clerk"],
      ["BSCS", "JHOANNA MARIE C. TUJON", "Registrar Clerk"],
      ["BSCRIM", "JIMWELL G. DACANAY", "Campus Registrar"],
    ])("maps %s to its assigned registrar", (course, name, position) => {
      expect(resolveDefaultSignatory(course)).toEqual({ name, position });
    });

    it("returns an empty signatory for an unknown program", () => {
      // drawSignature skips rendering entirely when both fields are empty.
      const result = resolveDefaultSignatory("UNKNOWN");
      expect(result.name).toBe("");
      expect(result.position).toBe("");
    });

    it("trims the roster's stray leading space", () => {
      // courses.ts holds BSCRIM with a leading space; it must not print.
      const result = resolveDefaultSignatory("BSCRIM");
      expect(result.name).not.toMatch(/^\s/);
      expect(result.name).toBe("JIMWELL G. DACANAY");
    });
  });
});
