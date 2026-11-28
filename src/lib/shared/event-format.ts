import type { CentralizedClubEvent } from "@/types/models";

/**
 * Formats an ISO event date string for concise public card display.
 */
export function formatEventDate(iso?: string): string {
  if (!iso) return "Date TBA";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats an ISO timestamp with date and time for deadline displays.
 */
export function formatEventDateTime(iso?: string): string {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "TBA";
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Computes the public status/registration badge label for an event.
 */
export function getEventBadgeLabel(event: CentralizedClubEvent): string {
  if (event.status === "archived") return "COMPLETED";
  if (event.isRegistrationOpen === false) return "REGISTRATIONS CLOSED";
  const now = Date.now();
  const deadlineMs = event.registrationDeadline
    ? new Date(event.registrationDeadline).getTime()
    : NaN;
  if (!isNaN(deadlineMs) && deadlineMs < now) return "DEADLINE PASSED";
  if ((event.currentRegistrations || 0) >= event.maxCapacity && event.maxCapacity > 0) {
    return "CAPACITY FULL";
  }
  return "REGISTRATIONS OPEN";
}
