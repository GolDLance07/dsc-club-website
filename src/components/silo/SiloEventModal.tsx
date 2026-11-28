import React from "react";
import {
  X,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Users,
  Globe,
  Layers,
  Tag,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { CentralizedClubEvent } from "@/types/models";
import {
  formatEventDate,
  formatEventDateTime,
  getEventBadgeLabel,
} from "@/lib/shared/event-format";

interface SiloEventModalProps {
  event: CentralizedClubEvent | null;
  onClose: () => void;
}

export const SiloEventModal: React.FC<SiloEventModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  const badgeLabel = getEventBadgeLabel(event);
  const isArchived = event.status === "archived";
  const isRegOpen = badgeLabel === "REGISTRATIONS OPEN";
  const startLabel = formatEventDate(event.startDate);
  const endLabel = formatEventDate(event.endDate);
  const dateDisplay =
    event.endDate && endLabel !== startLabel && endLabel !== "Date TBA"
      ? `${startLabel} – ${endLabel}`
      : startLabel;
  const remainingSeats = Math.max(0, (event.maxCapacity || 0) - (event.currentRegistrations || 0));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-10 shadow-2xl space-y-6 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {event.category || "CAMPUS EVENT"}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-700 font-semibold bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              {event.domainScope}
            </span>
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isArchived
                  ? "bg-slate-700 text-white"
                  : isRegOpen
                  ? "bg-blue-600 text-white"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              }`}
            >
              {badgeLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-full border border-slate-300 text-slate-500 hover:text-slate-900 hover:border-blue-600 hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Header Content */}
        <div className="space-y-2">
          <h2
            id="modal-title"
            className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 font-sans"
          >
            {event.title}
          </h2>

          {event.tagline && (
            <p className="text-xs sm:text-sm font-mono text-blue-700 font-semibold">
              {event.tagline}
            </p>
          )}

          <div className="font-mono text-xs text-slate-600 pt-1">
            <span className="text-blue-700 font-bold">
              {event.speaker || event.createdBy?.name || "DSC VIT Bhopal"}
            </span>
            <span className="text-slate-500"> — {event.domainScope} Division</span>
          </div>
        </div>

        {/* Logistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700">
          <div className="flex items-start gap-2.5">
            <Calendar className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                Dates
              </span>
              <span className="font-semibold text-slate-900">{dateDisplay}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Clock className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                Schedule Timing
              </span>
              <span className="font-semibold text-slate-900">{event.timeDisplay || "TBA"}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                Venue / Location
              </span>
              <span className="font-semibold text-slate-900">{event.venue || "Venue TBA"}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Globe className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                Delivery Mode &amp; Domain
              </span>
              <span className="font-semibold text-slate-900">
                {event.mode || "In-Person"} &bull; {event.domainScope}
              </span>
            </div>
          </div>
        </div>

        {/* Narrative & Details */}
        <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
          <p className="font-semibold text-slate-900">{event.description}</p>
          {event.longBio && <p className="text-slate-600 whitespace-pre-line">{event.longBio}</p>}
        </div>

        {/* Registration Metadata Box */}
        <div className="p-4 rounded-2xl border border-blue-200/80 bg-blue-50/50 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Tag className="size-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">Category</span>
              <strong className="text-slate-900">{event.category}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <Users className="size-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">Capacity</span>
              <strong className="text-slate-900">
                {event.currentRegistrations || 0} / {event.maxCapacity} reserved
              </strong>
              {!isArchived && isRegOpen && (
                <span className="text-[10px] text-blue-700 block">
                  {remainingSeats} seat(s) available
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <Layers className="size-4 text-blue-600 shrink-0" />
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">
                Registration Deadline
              </span>
              <strong className="text-slate-900">
                {formatEventDateTime(event.registrationDeadline)}
              </strong>
            </div>
          </div>
        </div>

        {/* Action Strip */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono text-xs font-bold text-slate-700">
            {isArchived
              ? "ARCHIVE RECORD // SESSION COMPLETED"
              : isRegOpen
              ? "REGISTRATIONS ACTIVE"
              : "REGISTRATIONS UNAVAILABLE"}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isArchived ? (
              <span className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-200 text-slate-700 font-mono text-xs font-bold uppercase px-6 py-3 rounded-full">
                EVENT ARCHIVED
              </span>
            ) : !isRegOpen ? (
              <span className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-100 text-amber-800 border border-amber-300 font-mono text-xs font-bold uppercase px-6 py-3 rounded-full">
                <AlertCircle className="size-3.5" />
                <span>{badgeLabel}</span>
              </span>
            ) : event.externalRegistrationUrl ? (
              <a
                href={event.externalRegistrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase px-8 py-3 rounded-full transition-all shadow-md cursor-pointer"
              >
                <span>REGISTER NOW</span>
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <Link
                to="/register"
                onClick={onClose}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase px-8 py-3 rounded-full transition-all shadow-md cursor-pointer"
              >
                <span>CLAIM PASS / REGISTER</span>
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
