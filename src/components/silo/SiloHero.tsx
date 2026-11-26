import React, { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const SiloHero: React.FC = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const progress = Math.min(Math.max(scrollY / 450, 0), 1);
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scale = 1 - scrollProgress * 0.05;
  const borderRadius = Math.round(16 + scrollProgress * 20);

  return (
    <section className="relative w-full pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-8 max-w-7xl mx-auto overflow-hidden">
      {/* Top Metadata Header */}
      <div className="hidden sm:flex items-center justify-between text-[11px] font-mono tracking-widest text-slate-500 mb-6 px-3 uppercase">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="font-bold text-[#0052cc] tracking-wider">DATA SCIENCE CLUB // VIT BHOPAL</span>
        </div>

        <div className="text-center tracking-[0.2em] text-slate-500">
          <span>MACHINE LEARNING // DISTRIBUTED SYSTEMS // OPEN INTELLIGENCE</span>
        </div>

        <div className="text-right">
          <span className="text-[#0052cc] font-bold">EST. 2019</span>
        </div>
      </div>

      {/* Main Hero Card with Dynamic Smooth Scroll Scaling */}
      <div
        ref={containerRef}
        style={{
          transform: `scale(${scale})`,
          borderRadius: `${borderRadius}px`,
          transition: "transform 0.1s ease-out, border-radius 0.15s ease-out",
        }}
        className="relative w-full aspect-[4/3] sm:aspect-[16/9] lg:aspect-[21/9] max-h-[720px] overflow-hidden border-2 border-slate-200 bg-gradient-to-br from-white via-blue-50/30 to-slate-50 shadow-xl shadow-blue-500/5"
      >
        {/* Subtle Ambient White & Blue Grid Pattern */}
        <div className="absolute inset-0 wb-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-400/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Ambient Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/30 to-transparent pointer-events-none" />

        {/* Bottom Banner Content */}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:p-14 flex flex-col sm:flex-row sm:items-end justify-between gap-6 z-10">
          <div className="space-y-3 sm:space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1 text-[10px] sm:text-xs font-mono font-semibold uppercase tracking-[0.2em] text-blue-700 backdrop-blur-md shadow-xs">
              <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span>DATA SCIENCE CLUB — VIT BHOPAL</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight text-slate-900 uppercase leading-none font-sans">
              DSC VIT <span className="text-[#0052cc]">BHOPAL</span>
            </h1>

            <p className="text-xs sm:text-base font-sans text-slate-600 max-w-xl leading-relaxed">
              Turning raw computational curiosities into production neural models, distributed data
              pipelines, and open-source intelligence.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <a
              href="#events"
              className="inline-flex items-center justify-center rounded-full bg-[#0052cc] px-7 sm:px-8 py-3.5 text-xs sm:text-sm font-mono font-bold tracking-wider text-white uppercase hover:bg-blue-700 hover:scale-[1.02] transition-all duration-300 shadow-md cursor-pointer"
            >
              EXPLORE SPRINTS
            </a>
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-full border-2 border-slate-300 hover:border-blue-600 bg-white/95 px-6 sm:px-7 py-3.5 text-xs sm:text-sm font-mono font-bold tracking-wider text-slate-800 hover:text-blue-700 uppercase hover:bg-blue-50/80 transition-all duration-300 cursor-pointer shadow-xs backdrop-blur-md"
            >
              <span>JOIN CORE</span>
              <ArrowRight className="size-3.5 ml-1.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
