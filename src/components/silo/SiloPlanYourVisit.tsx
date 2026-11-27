import React, { useState } from "react";
import {
  Car,
  Building2,
  Briefcase,
  Ticket,
  HelpCircle,
  UserCheck,
  ShieldCheck,
  MapPin,
  ArrowRight,
} from "lucide-react";

interface VisitTab {
  id: number;
  label: string;
  icon: React.ReactNode;
  title: string;
  badgeRight: string;
  mainLocation: string;
  subLocation: string;
  additionalInfo: string;
}

const visitTabs: VisitTab[] = [
  {
    id: 1,
    label: "Directions & Parking",
    icon: <Car className="size-5" />,
    title: "Campus Venue & Transit",
    badgeRight: "Complimentary designated parking available for verified attendees.",
    mainLocation: "Located along the Bhopal-Indore National Highway in central India.",
    subLocation: "VIT Bhopal University, Kothri Kalan, Sehore, Madhya Pradesh — 466114",
    additionalInfo:
      "Dedicated university shuttle services run regularly connecting Bhopal Junction, Habibganj (Rani Kamlapati Station), and the campus main gate. Registered hackathon attendees receive arrival parking clearances via email.",
  },
  {
    id: 2,
    label: "Accommodations",
    icon: <Building2 className="size-5" />,
    title: "Hackathon Stay & Dorms",
    badgeRight: "University guest house & dormitory arrangements for outstation cohorts.",
    mainLocation: "On-campus hostel accommodations provided for multi-day hackathon teams.",
    subLocation:
      "Over 8 vetted partner hotels situated along the highway corridor within 20 minutes.",
    additionalInfo:
      "All hackathon teams traveling from outside Madhya Pradesh receive dormitory lodging accommodations, hot water facilities, and designated 24/7 rest lounges inside the Innovation Center.",
  },
  {
    id: 3,
    label: "Hardware & Labs",
    icon: <Briefcase className="size-5" />,
    title: "Workstation Policies & Kit",
    badgeRight: "High-speed 1Gbps fiber drops & surge-protected power strips provided.",
    mainLocation: "Bring your development laptops, hardware microcontrollers, and chargers.",
    subLocation:
      "Prohibited: Unauthorized high-voltage equipment, soldering stations, or open flames.",
    additionalInfo:
      "Dedicated GPU computing clusters, high-speed campus Wi-Fi credentials, and extension boards will be provisioned directly upon registration badge collection.",
  },
  {
    id: 4,
    label: "Schedule & Check-in",
    icon: <Ticket className="size-5" />,
    title: "Arrival Protocols & Passes",
    badgeRight: "Digital QR gate passes issued through DSC registration portal.",
    mainLocation: "Check-in at Innovation Center Reception Desk Alpha 45 minutes prior.",
    subLocation: "Valid government or university student identification cards required.",
    additionalInfo:
      "Digital wallet passes and QR tickets generated on the registration portal will be scanned at security gate 1 and the lab reception kiosk for contactless badge printing.",
  },
  {
    id: 5,
    label: "Code of Conduct",
    icon: <ShieldCheck className="size-5" />,
    title: "Community Guidelines",
    badgeRight: "Zero-tolerance policy for harassment, discrimination, or intellectual theft.",
    mainLocation: "Inclusive, peer-driven engineering environment for all participants.",
    subLocation: "Open collaboration, responsible disclosure, and academic honesty expected.",
    additionalInfo:
      "Every attendee, speaker, sponsor, and volunteer is required to agree with our community code of conduct. Organizers will enforce these rules throughout all sprints and workshops.",
  },
  {
    id: 6,
    label: "FAQ & Inquiries",
    icon: <HelpCircle className="size-5" />,
    title: "Frequently Asked Questions",
    badgeRight: "Official support desk monitored by DSC core operations team.",
    mainLocation: "Have questions about eligibility, prerequisites, or team formation?",
    subLocation: "Reach out via our direct contact dispatch form or community Discord.",
    additionalInfo:
      "Whether you are a solo builder looking for a hackathon squad, an outstation attendee inquiring about travel reimbursements, or a beginner curious about workshops, we are here to assist.",
  },
];

export const SiloPlanYourVisit: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const selectedTab = visitTabs.find((t) => t.id === activeTab) || visitTabs[0];

  return (
    <section id="visit" className="w-full py-8 sm:py-12 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-600 block mb-2 font-bold">
            LOGISTICS & PROTOCOLS
          </span>
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-slate-900 font-sans">
            PLAN YOUR VISIT
          </h2>
          <p className="text-xs sm:text-sm font-mono text-slate-600 mt-2 max-w-xl">
            Everything you need to know about joining hackathons, attending hardware labs, transit,
            and campus guidelines.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Navigation Tabs */}
        <div className="lg:col-span-5 space-y-3">
          {visitTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex items-center justify-between ${
                  isActive
                    ? "border-blue-600 bg-blue-50/70 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`size-10 rounded-xl flex items-center justify-center transition-colors ${
                      isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tab.icon}
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-400 block mb-0.5">
                      0{tab.id} // PROTOCOL
                    </span>
                    <span
                      className={`text-base font-bold font-sans ${
                        isActive ? "text-blue-700" : "text-slate-900"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </div>
                </div>

                <ArrowRight
                  className={`size-4 transition-transform ${
                    isActive ? "text-blue-600 translate-x-1" : "text-slate-300"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right Column: Active Tab Details Card */}
        <div className="lg:col-span-7 rounded-3xl border-2 border-slate-200 bg-white p-8 sm:p-12 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200">
            <div>
              <span className="font-mono text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                PROTOCOL 0{selectedTab.id}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-3 font-sans">
                {selectedTab.title}
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 font-mono text-xs text-blue-900 font-semibold">
              {selectedTab.badgeRight}
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-bold text-slate-900 font-sans">
                {selectedTab.mainLocation}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-mono leading-relaxed">
                {selectedTab.subLocation}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 font-sans leading-relaxed pt-2">
              {selectedTab.additionalInfo}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
