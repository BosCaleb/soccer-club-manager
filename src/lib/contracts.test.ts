import { describe, it, expect } from "vitest";
import { matchTime, canManageFixtures, canPublishSquad } from "./contracts";
describe("presentation contracts", () => {
  it("renders UTC kickoff in SAST independently of machine timezone", () =>
    expect(matchTime("2026-11-14T08:00:00Z")).toBe("10:00"));
  it("keeps manager squad actions hidden and guardian fixture actions hidden", () => {
    expect(canPublishSquad("manager")).toBe(false);
    expect(canPublishSquad("coach")).toBe(true);
    expect(canManageFixtures("guardian")).toBe(false);
  });
});
