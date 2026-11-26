import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/sections/Navbar";
import { FooterSection } from "@/components/sections/FooterSection";
import { X, ZoomIn, Camera } from "lucide-react";
import hackathonImg from "@/assets/event-hackathon.jpg";
import workshopImg from "@/assets/event-workshop.jpg";
import talkImg from "@/assets/event-talk.jpg";
import teamImg from "@/assets/event-team.jpg";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — DSC Club VITB" },
      {
        name: "description",
        content:
          "Photos from DSC Club VITB hackathons, tech talks, workshops and team sessions at VIT Bhopal.",
      },
      { property: "og:title", content: "Gallery — DSC Club VITB" },
      { property: "og:description", content: "Moments from DataHacks, bootcamps and tech talks." },
    ],
  }),
  component: Gallery,
});

const photos = [
  {
    img: hackathonImg,
    tag: "DataHacks '25 Main Stage",
    category: "HACKATHON",
    span: "col-span-1 md:col-span-2 md:row-span-2",
  },
  {
    img: workshopImg,
    tag: "PyTorch Deep Learning Lab",
    category: "BOOTCAMP",
    span: "col-span-1 md:col-span-1 md:row-span-1",
  },
  {
    img: talkImg,
    tag: "AI Platforms Keynote",
    category: "TECH TALK",
    span: "col-span-1 md:col-span-1 md:row-span-1",
  },
  {
    img: teamImg,
    tag: "Core Developer Sprint",
    category: "TEAM",
    span: "col-span-1 md:col-span-2 md:row-span-1",
  },
  {
    img: workshopImg,
    tag: "Neural Networks Setup",
    category: "LAB SESSION",
    span: "col-span-1 md:col-span-1 md:row-span-2",
  },
  {
    img: talkImg,
    tag: "Industry Telemetry Meetup",
    category: "COMMUNITY",
    span: "col-span-1 md:col-span-1 md:row-span-1",
  },
  {
    img: hackathonImg,
    tag: "Campus Datathon Sprint",
    category: "HACKATHON",
    span: "col-span-1 md:col-span-1 md:row-span-1",
  },
  {
    img: teamImg,
    tag: "Onboarding Keynote Celebration",
    category: "ANNUAL REVEAL",
    span: "col-span-1 md:col-span-1 md:row-span-1",
  },
];

function Gallery() {
  const [activePhoto, setActivePhoto] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-transparent text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      <main className="relative pt-32 sm:pt-40 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3">
              <span className="size-8 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center font-mono text-xs font-bold text-[#0052cc] shadow-sm">
                05
              </span>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-[#0052cc]">
                <span className="size-1.5 rounded-full bg-[#0052cc]" />
                <span>MEDIA ARCHIVE & TELEMETRY</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-slate-900 mt-3 leading-none">
              VISUAL DOSSIER
            </h1>
            <p className="text-xs sm:text-sm font-mono text-slate-600 mt-2 max-w-xl">
              Photographic archives from 36-hour hackathons, hardware bootcamps, and technical
              keynotes across campus.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-600 bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-full shadow-sm">
            <Camera className="size-3.5 text-[#0052cc]" />
            <span>{photos.length} ARCHIVED RECORDS</span>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[240px]">
          {photos.map((item, idx) => (
            <div
              key={idx}
              onClick={() => setActivePhoto(idx)}
              className={`group relative rounded-3xl overflow-hidden border border-slate-200/90 bg-slate-100 cursor-pointer hover:border-blue-500 hover:shadow-[0_12px_35px_rgba(0,82,204,0.12)] hover:-translate-y-1 transition-all duration-300 ease-out ${item.span}`}
            >
              <img
                src={item.img}
                alt={item.tag}
                className="w-full h-full object-cover filter brightness-95 group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent opacity-75 group-hover:opacity-90 transition-opacity" />

              {/* Tag & Action */}
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between z-10">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-md border border-white/20 bg-slate-900/80 text-[9px] font-mono text-blue-300 uppercase tracking-widest backdrop-blur-md mb-1.5">
                    {item.category}
                  </span>
                  <p className="text-sm sm:text-base font-bold text-white group-hover:text-blue-200 transition-colors">
                    {item.tag}
                  </p>
                </div>

                <div className="size-8 rounded-full border border-white/30 bg-slate-900/60 flex items-center justify-center text-white group-hover:bg-[#0052cc] group-hover:border-[#0052cc] transition-all shrink-0 shadow-sm">
                  <ZoomIn className="size-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <FooterSection />

      {/* Lightbox Modal */}
      {activePhoto !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[85vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActivePhoto(null)}
              aria-label="Close lightbox"
              className="absolute top-4 right-4 z-10 size-10 rounded-full border border-slate-200 bg-white/90 text-slate-700 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer shadow-sm flex items-center justify-center"
            >
              <X className="size-5" />
            </button>

            <img
              src={photos[activePhoto].img}
              alt={photos[activePhoto].tag}
              className="w-full h-auto max-h-[75vh] object-contain rounded-2xl"
            />

            <div className="p-4 flex items-center justify-between font-mono text-xs text-slate-600">
              <span className="text-slate-900 font-bold">{photos[activePhoto].tag}</span>
              <span className="text-[#0052cc] font-semibold">{photos[activePhoto].category}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
