export type Role = "guardian" | "coach" | "manager" | "admin";
export type AvailabilityResponse = "available" | "unavailable" | "unsure";
export type FixtureStatus =
  "draft" | "published" | "postponed" | "cancelled" | "completed";
export type SelectionStatus = "selected" | "reserve" | "not_selected";
export interface FixtureSummary {
  id: string;
  teamId: string;
  opponent: string;
  kickoffAt: string;
  meetingAt: string;
  status: FixtureStatus;
  revision: number;
  responseDeadlineAt: string;
  venue: string;
  homeAway: "home" | "away";
}
export interface RegistrationApplication {
  id: string;
  submittedBy: string;
  status: "pending" | "approved" | "rejected";
  noticeVersion: string;
}
export interface SquadPublication {
  id: string;
  fixtureId: string;
  revision: number;
  publishedAt: string;
  entries: ReadonlyArray<{ playerId: string; selection: SelectionStatus }>;
}
export const canManageFixtures = (role: Role) =>
  ["coach", "manager", "admin"].includes(role);
export const canPublishSquad = (role: Role) =>
  role === "coach" || role === "admin";
export function matchTime(iso: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(iso));
}
export function matchDate(iso: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(iso));
}
