import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/sections/Navbar";
import { FooterSection } from "@/components/sections/FooterSection";
import {
  SiloEventModal,
  formatEventDate,
  getEventBadgeLabel,
} from "@/components/silo/SiloEventModal";
import { usePublicEvents } from "@/hooks/usePublicEvents";
import type { CentralizedClubEvent } from "@/types/models";
import { Calendar, Clock, MapPin, Ticket, Users, AlertCircle, RefreshCw, Globe } from "lucide-react";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — DSC Club VITB" },
      {
        name: "description",
        content:
          "Upcoming and archived events at DSC Club VITB: hackathons, PyTorch bootcamps, industry talks and datathons at VIT Bhopal.",
      },
      { property: "og:title", content: "Events — DSC Club VITB" },
      { property: "og:description", content: "Workshops, hackathons and tech talks by DSC VITB." },
    ],
  }),
  component: Events,
});

function Events() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [selectedEvent, setSelectedEvent] = useState<CentralizedClubEvent | null>(null);
  const { publishedEvents, archivedEvents, loading, error, refetch } = usePublicEvents({
    includeArchived: true,
  });

  const displayList = tab === "upcoming" ? publishedEvents : archivedEvents;

  return (
    <div className="min-h-screen bg-transparent text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="relative pt-32 sm:pt-40 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3">
              <span className="size-8 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center font-mono text-xs font-bold text-[#0052cc] shadow-sm">
                03
              </span>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-[#0052cc]">
                <span className="size-1.5 rounded-full bg-[#0052cc]" />
                <span>CALENDAR &amp; SPRINTS</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-slate-900 mt-3 leading-none">
              EVENTS &amp; HACKATHONS
            </h1>
            <p className="text-xs sm:text-sm font-mono text-slate-600 mt-2 max-w-xl">
              From 36-hour hackathons to deep learning bootcamps — reserve seats or explore archived
              club sessions.
            </p>
          </div>

          {/* Tab Selector Buttons */}
          <div className="flex items-center gap-2 p-1.5 rounded-full border border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
            <button
              type="button"
              onClick={() => setTab("upcoming")}
              className={`px-5 py-2 rounded-full text-xs font-mono uppercase tracking-wider transition-all duration-300 cursor-pointer ${tab === "upcoming"
                ? "bg-[#0052cc] text-white font-bold shadow-sm"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              UPCOMING ({publishedEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("past")}
              className={`px-5 py-2 rounded-full text-xs font-mono uppercase tracking-wider transition-all duration-300 cursor-pointer ${tab === "past"
                ? "bg-[#0052cc] text-white font-bold shadow-sm"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              ARCHIVE ({archivedEvents.length})
            </button>
          </div>
        </div>

        {/* Content Area: Loading / Error / Empty / Events Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {[0, 1, 2].map((skeletonIdx) => (
              <div
                key={skeletonIdx}
                className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 space-y-4 animate-pulse"
              >
                <div className="h-20 rounded-2xl bg-slate-100" />
                <div className="h-6 w-3/4 rounded-lg bg-slate-100" />
                <div className="h-12 rounded-lg bg-slate-100" />
                <div className="h-20 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mb-16 rounded-3xl border border-rose-200 bg-rose-50/90 p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-rose-900">
                  Failed to fetch events directory
                </h2>
                <p className="text-xs font-mono text-rose-700 mt-1">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase cursor-pointer"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : displayList.length === 0 ? (
          <div className="mb-16 rounded-3xl border border-slate-200/90 bg-white/95 p-12 text-center space-y-3 shadow-sm">
            <Calendar className="size-10 text-[#0052cc] mx-auto opacity-80" />
            <h2 className="text-xl font-black uppercase text-slate-900">
              {tab === "upcoming"
                ? "No Upcoming Events Announced Yet"
                : "No Archived Events Found"}
            </h2>
            <p className="text-xs font-mono text-slate-600 max-w-md mx-auto">
              {tab === "upcoming"
                ? "New workshops, talks, and hackathons will appear here immediately once published by the DSC Executive Board."
                : "Completed club events moved to the archive will appear here for reference."}
            </p>
            {tab === "upcoming" && archivedEvents.length > 0 && (
              <button
                type="button"
                onClick={() => setTab("past")}
                className="inline-flex items-center gap-2 rounded-full border border-blue-600 px-5 py-2 text-xs font-mono font-bold uppercase text-blue-700 hover:bg-[#0052cc] hover:text-white transition-colors mt-2 cursor-pointer"
              >
                View {archivedEvents.length} Archived Event(s)
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {displayList.map((evt) => {
              const badgeLabel = getEventBadgeLabel(evt);
              return (
                <article
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className="group relative rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-sm p-5 sm:p-6 flex flex-col justify-between hover:border-blue-500 hover:shadow-[0_12px_35px_rgba(0,82,204,0.1)] hover:-translate-y-1 transition-all duration-300 ease-out cursor-pointer"
                >
                  {/* Structured Header Block (No Poster Image Required) */}
                  <div>
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50/70 via-white to-slate-50 p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono tracking-wider">
                        <span className="text-[#0052cc] font-bold bg-white px-2.5 py-1 rounded-md border border-blue-200 shadow-2xs uppercase">
                          {evt.category}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-2xs ${evt.status === "archived"
                            ? "bg-slate-700 text-white"
                            : "bg-[#0052cc] text-white"
                            }`}
                        >
                          {badgeLabel}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pt-1">
                        <span className="font-semibold text-slate-800">{evt.domainScope}</span>
                        <span className="inline-flex items-center gap-1">
                          <Globe className="size-3 text-[#0052cc]" />
                          {evt.mode || "In-Person"}
                        </span>
                      </div>
                    </div>

                    {/* Information */}
                    <div className="mt-5 space-y-3">
                      <div className="text-[10px] font-mono text-[#0052cc] uppercase tracking-widest font-semibold">
                        {formatEventDate(evt.startDate)}
                      </div>
                      <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight leading-snug group-hover:text-[#0052cc] transition-colors">
                        {evt.title}
                      </h2>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {evt.description}
                      </p>

                      <div className="space-y-2 text-[11px] font-mono text-slate-600 border-t border-slate-100 pt-3.5">
                        <div className="flex items-center gap-2">
                          <Clock className="size-3.5 text-[#0052cc] shrink-0" />
                          <span className="text-slate-700 truncate">
                            {evt.timeDisplay || "Time TBA"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="size-3.5 text-[#0052cc] shrink-0" />
                          <span className="text-slate-700 truncate">
                            {evt.venue || "Venue TBA"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="size-3.5 text-[#0052cc] shrink-0" />
                          <span className="text-slate-700 truncate">
                            {evt.currentRegistrations || 0} / {evt.maxCapacity} seats reserved
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5">
                    <span className="inline-flex w-full items-center justify-center rounded-xl border border-blue-600/30 bg-blue-50/60 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-blue-700 group-hover:bg-[#0052cc] group-hover:text-white group-hover:border-[#0052cc] transition-all duration-300">
                      VIEW SESSION DETAILS
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Quick Registration Callout */}
        <div className="rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-sm p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left shadow-sm">
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
              LOOKING TO SECURE YOUR ENTRY PASS?
            </h3>
            <p className="text-xs sm:text-sm font-mono text-slate-600 max-w-xl">
              Access individual and team RSVPs with cryptographic QR check-in passes on the official
              registration desk.
            </p>
          </div>

          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-[#0052cc] px-8 py-3.5 text-xs font-mono font-bold tracking-wider text-white uppercase hover:bg-blue-700 hover:scale-[1.03] transition-all duration-300 shadow-md cursor-pointer shrink-0"
          >
            <Ticket className="size-4" />
            <span>OPEN REGISTRATION DESK</span>
          </Link>
        </div>
      </main>

      <FooterSection />

      {/* Interactive Detail Modal */}
      <SiloEventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
