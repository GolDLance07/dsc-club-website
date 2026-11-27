import React from "react";
import { X, Calendar, MapPin, Clock, ArrowRight, Ticket, Users, Github, Linkedin, Twitter } from "lucide-react";
import { Link } from "@tanstack/react-router";

export interface SiloEventData {
  id: string;
  code?: string;
  title: string;
  speaker?: string;
  role?: string;
  category?: string;
  date: string;
  time?: string;
  venue?: string;
  location?: string;
  venueDetails?: string;
  image?: string;
  description: string;
  longBio?: string;
  badge?: string;
  ticketPrice?: string;
  status?: string;
  seatsLeft?: number;
  eligibility?: string;
  prerequisites?: string[];
  registrationDeadline?: string;
  schedule?: { time: string; title: string }[];
  socials?: {
    github?: string;
    linkedin?: string;
    x?: string;
  };
}

interface SiloEventModalProps {
  event: SiloEventData | null;
  onClose: () => void;
}

export const SiloEventModal: React.FC<SiloEventModalProps> = ({ event, onClose }) => {
  if (!event) return null;

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
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {event.category || "CAMPUS EVENT"}
            </span>
            {event.badge && (
              <span className="bg-blue-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                {event.badge}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-full border border-slate-300 text-slate-500 hover:text-slate-900 hover:border-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Header Content */}
        <div className="space-y-3">
          <h2 id="modal-title" className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 font-sans">
            {event.title}
          </h2>

          {(event.speaker || event.role) && (
            <div className="font-mono text-xs text-slate-600">
              <span className="text-blue-700 font-bold">{event.speaker}</span>
              {event.role && <span className="text-slate-500"> — {event.role}</span>}
            </div>
          )}
        </div>

        {/* Logistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-blue-600 shrink-0" />
            <span>{event.date}</span>
          </div>
          {event.time && (
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-blue-600 shrink-0" />
              <span>{event.time}</span>
            </div>
          )}
          {(event.venue || event.location) && (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-blue-600 shrink-0" />
              <span className="truncate">{event.venue || event.location}</span>
            </div>
          )}
        </div>

        {/* Narrative & Details */}
        <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
          <p className="font-semibold text-slate-900">{event.description}</p>
          {event.longBio && <p className="text-slate-600">{event.longBio}</p>}
        </div>

        {/* Schedule if available */}
        {event.schedule && event.schedule.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
              EVENT TIMELINE
            </h4>
            <div className="space-y-2 border-l-2 border-blue-600 pl-4 font-mono text-xs text-slate-600">
              {event.schedule.map((item, idx) => (
                <div key={idx} className="flex items-baseline gap-3">
                  <span className="text-blue-700 font-bold shrink-0">{item.time}</span>
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Strip */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono text-xs font-bold text-slate-700">
            {event.ticketPrice || "OPEN REGISTRATION"}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              to="/register"
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase px-8 py-3 rounded-full transition-all shadow-md cursor-pointer"
            >
              <span>CLAIM PASS / REGISTER</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
