import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUp, MapPin, Terminal, Cpu, Database, Mail } from "lucide-react";

export const WhiteBlueFooter: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="w-full bg-[#f8fafc] text-slate-900 border-t-2 border-slate-200 py-16 px-4 sm:px-8 select-none">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Col 1: Brand & Charter */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/DSClogo.png"
                alt="DSC VIT Bhopal"
                className="h-11 w-auto object-contain"
              />
              <div>
                <span className="font-mono text-base font-black tracking-tight text-slate-900 block">
                  DATA SCIENCE CLUB
                </span>
                <span className="font-mono text-[11px] text-blue-600 font-bold tracking-wider block">
                  VIT BHOPAL UNIVERSITY
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed max-w-sm">
              Turning raw computational curiosities into production neural models, distributed data
              pipelines, and open-source intelligence.
            </p>

            <div className="pt-2 font-mono text-xs text-slate-500 space-y-1.5">
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-blue-600 shrink-0" />
                <span>Bhopal-Indore Highway, Kothrikalan, Sehore, MP — 466114</span>
              </div>
              <div className="flex items-center gap-2">
                <Terminal className="size-3.5 text-blue-600 shrink-0" />
                <span>CENTRAL INDIA&apos;S PREMIER STUDENT ML SOCIETY // EST. 2019</span>
              </div>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="md:col-span-3 space-y-3 font-mono text-xs">
            <span className="text-slate-400 uppercase tracking-widest font-bold block mb-2">
              NAVIGATION
            </span>
            <ul className="space-y-2.5 text-slate-600">
              <li>
                <Link to="/" className="hover:text-blue-600 transition-colors">
                  Home // Platform
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-blue-600 transition-colors">
                  About // Philosophy
                </Link>
              </li>
              <li>
                <Link to="/events" className="hover:text-blue-600 transition-colors">
                  Events & Hackathons
                </Link>
              </li>
              <li>
                <Link to="/gallery" className="hover:text-blue-600 transition-colors">
                  Visual Dossier Gallery
                </Link>
              </li>
              <li>
                <Link to="/members" className="hover:text-blue-600 transition-colors">
                  Members & Mentors
                </Link>
              </li>
              <li>
                <Link to="/join" className="hover:text-blue-600 transition-colors">
                  Join Core Team
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-blue-600 transition-colors">
                  Event Registration
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-blue-600 transition-colors text-slate-400">
                  Admin Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Research Divisions */}
          <div className="md:col-span-4 space-y-3 font-mono text-xs">
            <span className="text-slate-400 uppercase tracking-widest font-bold block mb-2">
              TECHNICAL DIVISIONS
            </span>
            <div className="space-y-2 text-slate-700">
              <div className="border border-slate-200 bg-white p-3 rounded-xl shadow-xs">
                <span className="text-blue-700 font-bold block">01 // Machine Learning</span>
                <span className="text-[11px] text-slate-500">Neural Architectures & Generative AI</span>
              </div>
              <div className="border border-slate-200 bg-white p-3 rounded-xl shadow-xs">
                <span className="text-blue-700 font-bold block">02 // Data Engineering</span>
                <span className="text-[11px] text-slate-500">Distributed Pipelines & Big Data</span>
              </div>
              <div className="border border-slate-200 bg-white p-3 rounded-xl shadow-xs">
                <span className="text-blue-700 font-bold block">03 // Interactive Development</span>
                <span className="text-[11px] text-slate-500">Next-Gen Web & Computational Interfaces</span>
              </div>
              <div className="border border-slate-200 bg-white p-3 rounded-xl shadow-xs">
                <span className="text-blue-700 font-bold block">04 // Analytics Depth</span>
                <span className="text-[11px] text-slate-500">Statistical Inferences & Predictive Modeling</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} DATA SCIENCE CLUB VIT BHOPAL. ALL RIGHTS RESERVED.
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 text-blue-600 font-bold hover:text-blue-800 transition-colors cursor-pointer"
            >
              <span>BACK TO TOP</span>
              <ArrowUp className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
