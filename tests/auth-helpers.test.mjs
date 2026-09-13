import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnPath } from "../lib/auth/return-path.ts";

test("safeReturnPath accepts internal paths", () => {
  assert.equal(safeReturnPath("/meetings/product-review?t=100"), "/meetings/product-review?t=100");
});

test("safeReturnPath rejects absolute and protocol-relative URLs", () => {
  assert.equal(safeReturnPath("https://example.com/steal"), "/meetings");
  assert.equal(safeReturnPath("//example.com/steal"), "/meetings");
});

test("safeReturnPath rejects backslash paths", () => {
  assert.equal(safeReturnPath("/\\evil"), "/meetings");
});