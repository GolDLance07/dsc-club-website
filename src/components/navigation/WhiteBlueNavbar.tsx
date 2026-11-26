import React, { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, X, ArrowUpRight } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Home" },
  { path: "/about", label: "About" },
  { path: "/events", label: "Events" },
  { path: "/gallery", label: "Gallery" },
  { path: "/members", label: "Members" },
  { path: "/join", label: "Join" },
  { path: "/register", label: "Register" },
];

export const WhiteBlueNavbar: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 border-b border-slate-200 backdrop-blur-md shadow-xs select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand with Original DSC Logo Preserved */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
          >
            <img
              src="/DSClogo.png"
              alt="Data Science Club VIT Bhopal"
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-mono text-base font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
              DSC VIT BHOPAL
            </span>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                  isActive
                    ? "text-[#0052cc] bg-blue-50/80 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/join"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0052cc] px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition-all cursor-pointer shadow-sm"
          >
            <span>JOIN CORE</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 hover:text-[#0052cc] focus:outline-none cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/98 backdrop-blur-xl px-4 py-6 space-y-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2.5 text-sm font-mono font-bold uppercase tracking-wider text-slate-700 hover:text-[#0052cc] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-4 border-t border-slate-100">
            <Link
              to="/join"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0052cc] px-6 py-3 text-xs font-mono font-bold uppercase tracking-wider text-white hover:bg-blue-700 transition-all cursor-pointer"
            >
              <span>JOIN CORE</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default WhiteBlueNavbar;
