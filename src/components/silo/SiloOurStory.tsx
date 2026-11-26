import React from "react";
import { Terminal, Cpu } from "lucide-react";

export const SiloOurStory: React.FC = () => {
  return (
    <section
      id="about"
      className="w-full py-8 sm:py-14 px-4 sm:px-8 max-w-5xl mx-auto text-center"
    >
      {/* Eyebrow & Number */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <span className="size-8 rounded-xl border-2 border-blue-600 bg-blue-50 flex items-center justify-center font-mono text-xs font-bold text-blue-700 shadow-xs">
          01
        </span>
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-blue-700 font-bold">
          <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
          <span>PHILOSOPHY & HERITAGE</span>
        </div>
      </div>

      <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-slate-900 leading-none font-sans">
        DSC VIT BHOPAL
      </h2>

      <p className="text-xs sm:text-sm font-mono text-slate-600 mt-4 tracking-wider uppercase max-w-xl mx-auto">
        The student engineering collective transforming central India&apos;s AI landscape.
      </p>

      {/* Signature Pill Manifesto Line */}
      <div className="mt-10 sm:mt-14 text-xl sm:text-3xl lg:text-4xl font-semibold text-slate-800 flex flex-wrap items-center justify-center gap-3">
        <span>DSC VIT Bhopal combines</span>
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-blue-600 bg-blue-50 px-5 sm:px-6 py-1.5 text-blue-700 font-mono text-base sm:text-2xl font-bold shadow-xs">
          <Cpu className="size-4 sm:size-5 text-blue-600" />
          <span>intelligence</span>
        </span>
        <span>and</span>
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-blue-600 bg-blue-50 px-5 sm:px-6 py-1.5 text-blue-700 font-mono text-base sm:text-2xl font-bold shadow-xs">
          <Terminal className="size-4 sm:size-5 text-blue-600" />
          <span>engineering</span>
        </span>
        <span>in a true technological experiment.</span>
      </div>

      {/* Historical Milestones */}
      <div className="mt-16 sm:mt-24 pt-12 border-t-2 border-slate-200 max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-8 sm:gap-14 text-left">
        <div className="shrink-0 text-center sm:text-left">
          <span className="text-6xl sm:text-7xl lg:text-8xl font-black font-mono tracking-tighter text-blue-600">
            2019
          </span>
          <span className="block text-[11px] font-mono uppercase tracking-widest text-slate-500 mt-1 font-bold">
            ESTABLISHED AT VIT BHOPAL
          </span>
        </div>

        <div className="space-y-4">
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-sans">
            Established in 2019 at VIT Bhopal University, the Data Science Club began with a bold
            mission: to bridge the divide between theoretical textbook algorithms and real-world,
            production-grade computational software. Today, we stand as a 1,500+ student ecosystem
            pushing the frontiers of neural networks, high-throughput distributed systems, and
            open-source technology.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/60 text-xs font-mono text-slate-800 shadow-xs">
              <span className="text-blue-700 font-bold">1,500+</span> Community Builders
            </div>
            <div className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/60 text-xs font-mono text-slate-800 shadow-xs">
              <span className="text-blue-700 font-bold">45+</span> Labs & Sprints Hosted
            </div>
            <div className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/60 text-xs font-mono text-slate-800 shadow-xs">
              <span className="text-blue-700 font-bold">₹2.5L+</span> Bounties & Hackathon Prizes
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
