import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, MapPin, Clock, AlertCircle, RefreshCw, Users } from "lucide-react";
import type { CentralizedClubEvent } from "@/types/models";
import { formatEventDate, getEventBadgeLabel } from "@/lib/shared/event-format";

interface SiloThisWeekProps {
  events: CentralizedClubEvent[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectEvent: (event: CentralizedClubEvent) => void;
}

export const SiloThisWeek: React.FC<SiloThisWeekProps> = ({
  events,
  loading = false,
  error = null,
  onRetry,
  onSelectEvent,
}) => {
  const featuredEvents = events.slice(0, 3);

  return (
    <section
      id="events"
      className="w-full py-8 sm:py-12 px-4 sm:px-8 max-w-7xl mx-auto"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-3">
            <span className="size-8 rounded-xl border-2 border-blue-600 bg-blue-50 flex items-center justify-center font-mono text-xs font-bold text-blue-700 shadow-xs">
              03
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-sans">
              This week at DSC
            </h2>
          </div>
          <p className="text-xs sm:text-sm font-mono text-slate-600 mt-2">
            Flagship bootcamps, hackathons, and technical deep-dives live from our club calendar.
          </p>
        </div>

        <div>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 hover:border-blue-600 bg-white hover:bg-blue-50 px-6 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-800 hover:text-blue-700 transition-colors uppercase cursor-pointer shadow-xs"
          >
            <span>VIEW ALL SPRINTS</span>
            <ArrowRight className="size-3 text-blue-600" />
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-3xl border-2 border-slate-200 bg-white p-6 space-y-4 animate-pulse"
            >
              <div className="h-24 rounded-2xl bg-slate-100" />
              <div className="h-6 w-3/4 rounded-lg bg-slate-100" />
              <div className="h-10 rounded-lg bg-slate-100" />
              <div className="h-16 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border-2 border-rose-200 bg-rose-50/70 p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-900">Unable to load published events</h3>
              <p className="text-xs font-mono text-rose-700 mt-1">{error}</p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      ) : featuredEvents.length === 0 ? (
        <div className="rounded-3xl border-2 border-slate-200 bg-slate-50/80 p-10 text-center space-y-3">
          <Calendar className="size-8 text-blue-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">No upcoming events published yet</h3>
          <p className="text-xs font-mono text-slate-600 max-w-md mx-auto">
            New workshops and hackathons will appear here as soon as they are approved and published.
            You can browse past club milestones in the archive.
          </p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 rounded-full border border-blue-600 bg-white px-6 py-2 text-xs font-mono font-bold text-blue-700 hover:bg-blue-600 hover:text-white transition-colors uppercase mt-2"
          >
            <span>Explore Events Archive</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        /* Featured Event Cards (No poster images required) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredEvents.map((evt) => {
            const badgeLabel = getEventBadgeLabel(evt);
            return (
              <article
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="group relative rounded-3xl border-2 border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between hover:border-blue-600 hover:shadow-xl hover:shadow-blue-600/10 hover:-translate-y-1 transition-all duration-300 ease-out cursor-pointer"
              >
                <div>
                  {/* Structured Telemetry Banner Header (Poster-free) */}
                  <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono tracking-wider">
                      <span className="text-blue-700 font-bold bg-white px-2.5 py-1 rounded-md border border-blue-200 shadow-2xs">
                        {evt.category}
                      </span>
                      <span className="bg-blue-600 text-white text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-2xs">
                        {badgeLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pt-1">
                      <span className="font-semibold text-slate-800">{evt.domainScope}</span>
                      <span>{evt.mode || "In-Person"}</span>
                    </div>
                  </div>

                  {/* Event Description & Info */}
                  <div className="pt-5 space-y-3">
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors font-sans">
                      {evt.title}
                    </h3>

                    <p className="text-xs text-slate-600 font-sans line-clamp-2 leading-relaxed">
                      {evt.description}
                    </p>

                    <div className="space-y-1.5 pt-2 text-xs font-mono text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-blue-600 shrink-0" />
                        <span>{formatEventDate(evt.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 text-blue-600 shrink-0" />
                        <span>{evt.timeDisplay || "Time TBA"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{evt.venue || "Venue TBA"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Action */}
                <div className="pt-5 mt-5 border-t border-slate-200 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700">
                    <Users className="size-3.5 text-blue-600" />
                    <span>
                      {evt.currentRegistrations || 0}/{evt.maxCapacity} Seats
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                    <span>INSPECT SPEC</span>
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
