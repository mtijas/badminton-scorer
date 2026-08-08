import { describe, expect, it, vi } from "vitest";

import {
  parseMigrationFilename,
  preserveAppliedMigrationNames,
} from "./run-migrations.mjs";

describe("migration filenames", () => {
  it("parses the supported UTC filename format", () => {
    expect(
      parseMigrationFilename("20260802104500000_create_match.sql"),
    ).toEqual({
      currentName: "20260802104500000_create_match",
      legacyName: "20260802104500_create_match",
      timestamp: "20260802104500000",
    });
  });

  it.each([
    "20260802104500_create_match.sql",
    "20261302104500000_create_match.sql",
    "20260802104500000-create-match.sql",
    "notes.txt",
  ])("rejects the invalid filename %s", (filename) => {
    expect(() => parseMigrationFilename(filename)).toThrow(
      /Invalid (migration filename|UTC timestamp)/,
    );
  });
});

describe("applied migration compatibility", () => {
  it("updates a legacy migration record without changing its id", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ table_name: "pgmigrations" }] })
      .mockResolvedValueOnce({
        rows: [{ name: "20260802104500_create_match" }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await preserveAppliedMigrationNames({ query }, [
      {
        currentName: "20260802104500000_create_match",
        legacyName: "20260802104500_create_match",
        timestamp: "20260802104500000",
      },
    ]);

    expect(query).toHaveBeenLastCalledWith(
      "UPDATE public.pgmigrations SET name = $1 WHERE name = $2",
      ["20260802104500000_create_match", "20260802104500_create_match"],
    );
  });

  it("does nothing before the migration table exists", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ table_name: null }] });

    await preserveAppliedMigrationNames({ query }, []);

    expect(query).toHaveBeenCalledTimes(1);
  });
});
