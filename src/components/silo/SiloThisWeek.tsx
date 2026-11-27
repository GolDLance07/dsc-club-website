import React from "react";
import { Link } from "@tanstack/react-router";
import { SiloEventData } from "./SiloEventModal";
import { thisWeekEvents } from "./siloData";
import { ArrowRight, Calendar, MapPin, Clock } from "lucide-react";

interface SiloThisWeekProps {
  onSelectEvent: (event: SiloEventData) => void;
}

export const SiloThisWeek: React.FC<SiloThisWeekProps> = ({ onSelectEvent }) => {
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
            Flagship bootcamps, 36-hour hackathons, and technical deep-dives with open reservations.
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

      {/* 3 Showcase Event Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {thisWeekEvents.map((evt) => (
          <article
            key={evt.id}
            onClick={() => onSelectEvent(evt)}
            className="group relative rounded-3xl border-2 border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between hover:border-blue-600 hover:shadow-xl hover:shadow-blue-600/10 hover:-translate-y-1 transition-all duration-300 ease-out cursor-pointer"
          >
            {/* Poster Art with Crisp White & Blue Details */}
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src={evt.image}
                alt={evt.title}
                className="w-full h-full object-cover filter contrast-105 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />

              {/* Poster Top Badges */}
              <div className="absolute top-4 inset-x-4 flex items-center justify-between text-[10px] font-mono tracking-wider">
                <span className="text-blue-700 font-bold bg-white/95 px-2.5 py-1 rounded-md border border-blue-200 shadow-sm">
                  DSC VITB
                </span>
                <span className="text-slate-800 font-bold uppercase bg-white/95 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
                  {evt.category}
                </span>
              </div>

              {/* Status Badge */}
              {evt.badge && (
                <div className="absolute bottom-4 right-4">
                  <span className="bg-blue-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                    {evt.badge}
                  </span>
                </div>
              )}
            </div>

            {/* Event Description & Info */}
            <div className="pt-6 space-y-3">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors font-sans">
                {evt.title}
              </h3>

              <p className="text-xs text-slate-600 font-sans line-clamp-2 leading-relaxed">
                {evt.description}
              </p>

              <div className="space-y-1.5 pt-2 text-xs font-mono text-slate-600">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-blue-600" />
                  <span>{evt.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-blue-600" />
                  <span>{evt.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-blue-600" />
                  <span>{evt.venue}</span>
                </div>
              </div>
            </div>

            {/* Bottom Card Action */}
            <div className="pt-6 mt-6 border-t border-slate-200 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-blue-700">
                {evt.ticketPrice}
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                <span>INSPECT SPEC</span>
                <ArrowRight className="size-3.5" />
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
