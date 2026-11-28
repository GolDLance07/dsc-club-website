import React from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import type { CentralizedClubEvent } from "@/types/models";
import { formatEventDate, getEventBadgeLabel } from "@/lib/shared/event-format";

interface SiloUpcomingEventsProps {
  events: CentralizedClubEvent[];
  loading?: boolean;
  error?: string | null;
  onSelectEvent: (event: CentralizedClubEvent) => void;
}

export const SiloUpcomingEvents: React.FC<SiloUpcomingEventsProps> = ({
  events,
  loading = false,
  error = null,
  onSelectEvent,
}) => {
  // Show published events beyond the top 3 featured highlights to avoid duplicate cards on homepage
  const additionalEvents = events.slice(3, 11);

  return (
    <section
      id="upcoming-events"
      className="w-full py-16 sm:py-24 px-4 sm:px-8 max-w-7xl mx-auto scroll-mt-24 relative z-10"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-600 block mb-2 font-bold">
            CURRICULAR SPRINTS &amp; LABS
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-sans">
            UPCOMING LAB SESSIONS
          </h2>
          <p className="text-xs sm:text-sm font-mono text-slate-600 mt-2 max-w-xl">
            Explore upcoming engineering labs, agentic AI workshops, and competitive tracks.
          </p>
        </div>

        <Link
          to="/events"
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-blue-600 hover:text-blue-800 uppercase"
        >
          <span>Full Calendar &amp; Archive</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Loading / Error / Empty / Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border-2 border-slate-200 bg-white p-5 h-56 animate-pulse space-y-3"
            >
              <div className="h-5 w-24 rounded-full bg-slate-100" />
              <div className="h-6 w-full rounded-lg bg-slate-100" />
              <div className="h-12 w-full rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-xs font-mono text-slate-600">
          Upcoming lab schedule is temporarily unavailable ({error}).
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-xs font-mono text-slate-600">
          Additional workshops and lab sessions will populate automatically once published in the Club Management Panel.
        </div>
      ) : additionalEvents.length === 0 ? (
        <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              All {events.length} active session{events.length === 1 ? " is" : "s are"} featured above
            </h3>
            <p className="text-xs font-mono text-slate-600">
              Inspect any featured session above for timings &amp; registration, or view past club events in our archive.
            </p>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 rounded-full bg-[#0052cc] px-5 py-2.5 text-xs font-mono font-bold text-white uppercase hover:bg-blue-700 transition-colors shrink-0"
          >
            <span>Open Events Directory</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {additionalEvents.map((evt) => {
            const badgeLabel = getEventBadgeLabel(evt);
            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="group relative rounded-2xl border-2 border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-blue-600 hover:shadow-lg hover:shadow-blue-600/10 transition-all duration-300 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 uppercase">
                      {evt.category}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-slate-600 uppercase">
                      {evt.mode || "In-Person"}
                    </span>
                  </div>

                  <span className="inline-block bg-blue-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full mb-2">
                    {badgeLabel}
                  </span>

                  <h3 className="text-base font-bold text-slate-900 mt-1 group-hover:text-blue-600 transition-colors font-sans line-clamp-2">
                    {evt.title}
                  </h3>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2 font-sans">
                    {evt.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200 space-y-1 font-mono text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3 text-blue-600 shrink-0" />
                    <span>{formatEventDate(evt.startDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3 text-blue-600 shrink-0" />
                    <span className="truncate">{evt.timeDisplay || "Time TBA"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3 text-blue-600 shrink-0" />
                    <span className="truncate">{evt.venue || "Venue TBA"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
