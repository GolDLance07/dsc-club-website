/**
 * DSC VIT Bhopal — Pure Shared Event Validation Module
 *
 * Platform-agnostic validation logic. Runs identically across:
 * - Cloudflare Workers (V8 isolate)
 * - Browser (React UI)
 * - Node.js (Admin CLI & Automated Tests)
 *
 * ZERO dependencies on Node-only or browser-only APIs.
 */

export const ALLOWED_DOMAINS = [
  "Technical",
  "AI & Data Science",
  "Design & Media",
  "Content & Editorial",
  "Management & PR",
] as const;

export type ClubDomain = (typeof ALLOWED_DOMAINS)[number];

/**
 * Parses timestamp value from ISO string, Date, number, or Firestore timestamp object.
 */
export function parseTimestampMs(val: unknown): number {
  if (!val) return NaN;
  if (typeof val === "number") return val;
  if (val instanceof Date) return val.getTime();
  if (typeof (val as { toDate?: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof (val as { seconds?: number }).seconds === "number") {
    return (val as { seconds: number }).seconds * 1000;
  }
  if (typeof (val as { _seconds?: number })._seconds === "number") {
    return (val as { _seconds: number })._seconds * 1000;
  }
  if (typeof val === "string") {
    return new Date(val).getTime();
  }
  return NaN;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface EventLike {
  title?: string;
  description?: string;
  longBio?: string;
  venue?: string;
  timeDisplay?: string;
  domainScope?: string;
  startDate?: unknown;
  endDate?: unknown;
  registrationDeadline?: unknown;
}

/**
 * Comprehensive publishing validation.
 * Enforces all content lengths and chronological constraints.
 */
export function validateEventForPublish(event: EventLike): ValidationResult {
  const errors: string[] = [];

  if (!event.title || typeof event.title !== "string" || event.title.trim().length < 5) {
    errors.push("Title must be at least 5 characters long.");
  }

  if (!event.description || typeof event.description !== "string" || event.description.trim().length < 20) {
    errors.push("Description overview must be at least 20 characters long.");
  }

  if (!event.longBio || typeof event.longBio !== "string" || event.longBio.trim().length < 50) {
    errors.push("Detailed briefing (longBio) must be at least 50 characters long.");
  }

  if (!event.venue || typeof event.venue !== "string" || event.venue.trim().length === 0) {
    errors.push("Venue / location is required.");
  }

  if (!event.timeDisplay || typeof event.timeDisplay !== "string" || event.timeDisplay.trim().length === 0) {
    errors.push("Time display string is required.");
  }

  if (
    !event.domainScope ||
    !ALLOWED_DOMAINS.includes(event.domainScope as ClubDomain)
  ) {
    errors.push(
      `Invalid domainScope "${String(event.domainScope)}". Must be one of: ${ALLOWED_DOMAINS.join(", ")}.`
    );
  }

  const start = parseTimestampMs(event.startDate);
  const end = parseTimestampMs(event.endDate);
  const deadline = parseTimestampMs(event.registrationDeadline);

  if (isNaN(start) || isNaN(end)) {
    errors.push("Start and End dates must be valid ISO timestamps.");
  } else if (end < start) {
    errors.push("End date cannot occur before start date.");
  }

  if (isNaN(deadline)) {
    errors.push("Registration deadline must be a valid ISO timestamp.");
  } else if (deadline > start) {
    errors.push("Registration deadline cannot occur after event starts.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
