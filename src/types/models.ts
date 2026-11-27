/**
 * Data Models & Schemas for Data Science Club (DSC) Web Platform
 * Conforming to system-design.md specifications.
 */

// ==========================================
// 1. RBAC & User Roles
// ==========================================
export type RoleType = "super_admin" | "faculty_coordinator" | "team_lead" | "member";

export type LeadDomain =
  | "Technical"
  | "AI & Data Science"
  | "Design & Media"
  | "Content & Editorial"
  | "Management & PR"
  | "None";

export interface UserRoleRecord {
  $id?: string;
  id: string;
  userId?: string;
  email: string;
  fullName: string;
  role: RoleType;
  title: string; // e.g. "President", "Vice President", "Technical Lead", "Faculty Coordinator"
  leadDomain?: LeadDomain;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// 2. Events & Registrations
// ==========================================
export type EventTag = "HACKATHON" | "BOOTCAMP" | "WORKSHOP" | "TECH TALK" | "MEETUP";

export type EventStatus = "draft" | "published" | "archived";

export interface EventPosterItem {
  id: string; // Unique identifier for the poster slot
  url: string; // Preview/download URL
  storagePath: string; // Path in Firebase Storage: events/{eventId}/posters/{posterId}.ext
  caption?: string | undefined; // Optional human-readable caption
  isPrimary: boolean; // Exactly one poster must have isPrimary === true
  displayOrder: number; // Order index: 1 to 5
  width?: number | undefined;
  height?: number | undefined;
  uploadedAt?: string | undefined;
}

export interface CentralizedClubEvent {
  id: string; // Unique document ID (e.g. slug-based or uuid)
  slug: string; // URL-safe unique slug
  title: string; // Event title (5 - 120 chars)
  tagline?: string | undefined; // Optional short tagline
  category: EventTag | string; // Classification category
  status: EventStatus; // Lifecycle state: 'draft' | 'published' | 'archived'
  domainScope: LeadDomain; // Domain responsible for the event
  startDate: string; // ISO 8601 start timestamp
  endDate: string; // ISO 8601 end timestamp
  timeDisplay: string; // Human readable timing e.g. "10:00 AM - 4:00 PM IST"
  venue: string; // Venue location name / auditorium / online
  description: string; // Overview summary (20+ chars)
  longBio: string; // Detailed briefing for details modal (50+ chars)
  posters: EventPosterItem[]; // Array of 1 to 5 poster objects
  maxCapacity: number; // Attendee capacity ceiling
  currentRegistrations: number; // System-managed counter
  registrationDeadline: string; // ISO 8601 deadline (deadline <= startDate)
  isRegistrationOpen?: boolean | undefined;
  externalRegistrationUrl?: string | undefined;
  createdBy: {
    uid: string;
    email: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | undefined;
  archivedAt?: string | undefined;
}

export interface ClubEvent {
  $id?: string;
  id: string;
  slug: string;
  title: string;
  tag: EventTag;
  eventDate: string; // ISO date or display date
  venue: string;
  description: string;
  bannerImage?: string;
  isRegistrationOpen: boolean;
  registrationDeadline: string; // ISO timestamp
  maxCapacity: number;
  currentRegistrations: number;
  isPaidEvent: boolean;
  registrationFee: number; // in INR (₹)
  upiId?: string; // UPI VPA e.g. dscvitb@upi
  upiPayeeName?: string;
  createdAt?: string;
}

export type RegistrationType = "individual" | "team";
export type PaymentStatus = "free" | "pending_verification" | "paid" | "failed";
export type RegistrationStatus = "confirmed" | "waitlisted" | "cancelled";
export type ResidenceType = "Hosteller" | "Day Scholar";

export interface TeamMember {
  fullName: string;
  regNumber: string;
  email: string;
  phone: string;
  branch: string;
  yearSemester: string;
  residenceType: ResidenceType;
}

export interface RegistrationRecord {
  $id?: string;
  id: string;
  eventId: string;
  eventTitle: string;
  registrationId: string; // DSC-[EVENT]-IND/TEAM-[HASH]
  regType: RegistrationType;
  fullName: string;
  regNumber: string;
  email: string;
  phone: string;
  branch: string;
  yearSemester: string;
  department: string;
  residenceType: ResidenceType;
  teamName?: string | undefined;
  teamSize?: number | undefined;
  teamMembers?: TeamMember[] | undefined;
  paymentStatus: PaymentStatus;
  paymentUtr?: string | undefined;
  paymentReceiptUrl?: string | undefined;
  paymentAmount: number;
  registrationStatus: RegistrationStatus;
  registeredAt: string;
}

// ==========================================
// 3. Hiring & Recruitment Portal
// ==========================================
export type ApplicationStatus =
  | "applied"
  | "shortlisted"
  | "interview"
  | "selected"
  | "rejected";

export interface DomainQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "url";
  placeholder?: string | undefined;
  required: boolean;
}

export interface HiringDomain {
  $id?: string | undefined;
  id: string;
  domainName: LeadDomain;
  shortDescription: string;
  fullDescription: string;
  skills: string[];
  isOpen: boolean;
  questions: DomainQuestion[];
}

export interface ApplicationRecord {
  $id?: string | undefined;
  id: string;
  fullName: string;
  registrationNumber: string;
  email: string;
  phone: string;
  branch: string;
  year: string;
  primaryTeam: LeadDomain;
  secondaryTeam?: LeadDomain | undefined;
  portfolioUrl?: string | undefined;
  githubUrl?: string | undefined;
  linkedinUrl?: string | undefined;
  resumeFileId?: string | undefined;
  resumeFileName?: string | undefined;
  resumeFileUrl?: string | undefined;
  whyJoin: string;
  domainAnswers: Record<string, string>; // questionId -> answer
  status: ApplicationStatus;
  reviewerNotes?: string | undefined;
  submittedAt: string;
  updatedAt?: string | undefined;
}

// ==========================================
// 4. Finance & Bookkeeping Section
// ==========================================
export type TransactionType = "income" | "expense";

export type IncomeCategory =
  | "Registration Fee"
  | "Sponsorship"
  | "College Grant"
  | "Merchandise"
  | "Other Income";

export type ExpenseCategory =
  | "Venue"
  | "Food"
  | "Prizes"
  | "Marketing"
  | "Logistics"
  | "Misc";

export type PaymentMode = "UPI" | "Bank Transfer" | "Cash" | "Card" | "College Requisition";

export interface FinanceTransaction {
  $id?: string | undefined;
  id: string;
  sheetId: string; // Event ID or "general_treasury"
  eventId: string;
  eventTitle: string;
  type: TransactionType;
  category: IncomeCategory | ExpenseCategory;
  amount: number;
  description: string;
  billFileId?: string | undefined;
  billFileName?: string | undefined;
  billFileUrl?: string | undefined; // Appwrite storage URL or local preview data URI
  paymentMode: PaymentMode;
  transactionRef?: string | undefined; // UTR or Invoice No.
  transactionDate: string; // ISO date
  addedByEmail: string;
  addedByName?: string | undefined;
  createdAt: string;
}

export interface FinanceSheet {
  $id?: string | undefined;
  id: string;
  eventId: string;
  eventTitle: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  lastUpdated: string;
}

// ==========================================
// 5. Activity Logs & Auditing
// ==========================================
export type AuditModule = "Registration" | "Hiring" | "Finance" | "UserRole" | "Settings";

export interface ActivityLog {
  $id?: string;
  id: string;
  actorEmail: string;
  actorName: string;
  actorRole: RoleType;
  actionType: string; // e.g. "CREATE_TRANSACTION", "UPDATE_APPLICATION_STATUS", "ASSIGN_ROLE"
  targetModule: AuditModule;
  targetEntityId?: string;
  details: string;
  timestamp: string;
}

// ==========================================
// 6. Global System Settings
// ==========================================
export interface SystemSettings {
  isHiringOpen: boolean;
  hiringDeadline: string; // ISO timestamp
  announcementHeadline: string;
  showAnnouncement: boolean;
  defaultUpiId: string;
  defaultUpiPayeeName: string;
  contactEmail: string;
  lastBackupAt?: string;
}
