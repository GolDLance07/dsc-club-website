import React from "react";
import { SiloEventData } from "./SiloEventModal";
import { upcomingEventList } from "./siloData";
import { ArrowRight, Calendar, MapPin, Clock } from "lucide-react";

interface SiloUpcomingEventsProps {
  onSelectEvent: (event: SiloEventData) => void;
}

export const SiloUpcomingEvents: React.FC<SiloUpcomingEventsProps> = ({ onSelectEvent }) => {
  return (
    <section id="upcoming-events" className="w-full py-16 sm:py-24 px-4 sm:px-8 max-w-7xl mx-auto scroll-mt-24 relative z-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-600 block mb-2 font-bold">
            CURRICULAR SPRINTS & LABS
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-sans">
            UPCOMING LAB SESSIONS
          </h2>
          <p className="text-xs sm:text-sm font-mono text-slate-600 mt-2 max-w-xl">
            Explore upcoming engineering labs, agentic AI workshops, and Kaggle competition tracks.
          </p>
        </div>
      </div>

      {/* 2-Row / 4-Col Grid of Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {upcomingEventList.map((evt) => (
          <div
            key={evt.id}
            onClick={() => onSelectEvent(evt)}
            className="group relative rounded-2xl border-2 border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-blue-600 hover:shadow-lg hover:shadow-blue-600/10 transition-all duration-300 cursor-pointer"
          >
            <div>
              {/* Event Image */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100 mb-4">
                <img
                  src={evt.image}
                  alt={evt.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {evt.badge && (
                  <span className="absolute top-2 right-2 bg-blue-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    {evt.badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 uppercase">
                {evt.category}
              </span>

              <h3 className="text-base font-bold text-slate-900 mt-3 group-hover:text-blue-600 transition-colors font-sans line-clamp-2">
                {evt.title}
              </h3>

              <p className="text-xs text-slate-600 mt-2 line-clamp-2 font-sans">
                {evt.description}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 space-y-1 font-mono text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3 text-blue-600 shrink-0" />
                <span>{evt.date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3 text-blue-600 shrink-0" />
                <span className="truncate">{evt.venue}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
