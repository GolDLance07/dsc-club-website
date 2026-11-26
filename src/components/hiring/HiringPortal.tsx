import React, { useState, useEffect, useMemo } from "react";
import { dataEngine } from "@/lib/data-engine";
import type { HiringDomain, LeadDomain, SystemSettings, ApplicationRecord } from "@/types/models";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Code2,
  Brain,
  Palette,
  FileText,
  Briefcase,
  Upload,
  ArrowRight,
  Share2,
  Copy,
  Check,
  RefreshCw,
  ChevronRight,
  Send,
  HelpCircle,
} from "lucide-react";
import "./HiringPortal.css";

const BRANCH_OPTIONS = [
  "Computer Science & Engineering (Core)",
  "CSE with AI & Machine Learning",
  "CSE with Data Science",
  "CSE with Cyber Security & Digital Forensics",
  "CSE with Cloud Computing & Automation",
  "CSE with Gaming Technology",
  "Electronics & Communication Engineering",
  "Mechanical Engineering",
  "Aerospace Engineering",
  "Bioengineering",
  "Integrated M.Tech (CSE / Software)",
  "Other / Multidisciplinary",
];

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  Technical: <Code2 className="size-5 text-[#0052cc]" />,
  "AI & Data Science": <Brain className="size-5 text-blue-600" />,
  "Design & Media": <Palette className="size-5 text-indigo-600" />,
  "Content & Editorial": <FileText className="size-5 text-sky-600" />,
  "Management & PR": <Briefcase className="size-5 text-blue-700" />,
};

export const HiringPortal: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [domains, setDomains] = useState<HiringDomain[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Domain Preview
  const [activeTabDomain, setActiveTabDomain] = useState<LeadDomain>("Technical");

  // Form State
  const [fullName, setFullName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branch, setBranch] = useState(BRANCH_OPTIONS[0]);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [primaryTeam, setPrimaryTeam] = useState<LeadDomain>("Technical");
  const [secondaryTeam, setSecondaryTeam] = useState<LeadDomain | "None">("AI & Data Science");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [whyJoin, setWhyJoin] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeDataUrl, setResumeDataUrl] = useState("");

  // Dynamic Domain Questions State (questionId -> answer)
  const [domainAnswers, setDomainAnswers] = useState<Record<string, string>>({});

  // Countdown State
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<ApplicationRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  // Fetch initial settings & domains
  useEffect(() => {
    const initData = async () => {
      try {
        const [currSettings, currDomains] = await Promise.all([
          dataEngine.getSystemSettings(),
          dataEngine.getHiringDomains(),
        ]);
        setSettings(currSettings);
        setDomains(currDomains);
      } catch (err) {
        console.error("Failed to load hiring metadata", err);
      } finally {
        setLoading(false);
      }
    };
    initData();

    const handleSync = async () => {
      try {
        const [currSettings, currDomains] = await Promise.all([
          dataEngine.getSystemSettings(),
          dataEngine.getHiringDomains(),
        ]);
        setSettings(currSettings);
        setDomains(currDomains);
      } catch (err) {
        console.error("Error refreshing hiring data", err);
      }
    };

    window.addEventListener("dsc_data_change", handleSync);
    return () => window.removeEventListener("dsc_data_change", handleSync);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!settings?.hiringDeadline) return;
    const updateCountdown = () => {
      const deadline = new Date(settings.hiringDeadline).getTime();
      const diff = deadline - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [settings?.hiringDeadline]);

  // Is recruitment open and within deadline?
  const isHiringOpen = useMemo(() => {
    if (!settings) return false;
    if (!settings.isHiringOpen) return false;
    const deadline = new Date(settings.hiringDeadline).getTime();
    return deadline > Date.now();
  }, [settings]);

  // Active Domain for Preview Tabs
  const currentTabDomain = useMemo(() => {
    return domains.find((d) => d.domainName === activeTabDomain) || domains[0] || null;
  }, [domains, activeTabDomain]);

  // Dynamic questions for the chosen primary team
  const primaryDomainConfig = useMemo(() => {
    return domains.find((d) => d.domainName === primaryTeam) || null;
  }, [domains, primaryTeam]);

  // Handle Dynamic Question changes
  const handleAnswerChange = (qId: string, val: string) => {
    setDomainAnswers((prev) => ({
      ...prev,
      [qId]: val,
    }));
  };

  // Resume File Upload (with client-side size check)
  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Resume file size exceeds 5MB limit. Please upload a smaller PDF.");
      return;
    }

    setResumeFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setResumeDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Copy Application ID
  const handleCopyAppId = () => {
    if (!submittedApp) return;
    navigator.clipboard.writeText(submittedApp.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!isHiringOpen) {
      setErrorMessage("Recruitment is currently closed. Submissions cannot be accepted.");
      return;
    }

    if (!fullName.trim() || !regNumber.trim() || !email.trim() || !phone.trim() || !whyJoin.trim()) {
      setErrorMessage("Please complete all required personal details and statement of purpose.");
      return;
    }

    // Validate dynamic required questions
    if (primaryDomainConfig?.questions) {
      for (const q of primaryDomainConfig.questions) {
        const answer = domainAnswers[q.id];
        if (q.required && (!answer || !answer.trim())) {
          setErrorMessage(`Please answer the required domain question: "${q.label}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const created = await dataEngine.submitHiringApplication({
        fullName: fullName.trim(),
        registrationNumber: regNumber.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        branch,
        year,
        primaryTeam,
        secondaryTeam: secondaryTeam === "None" ? undefined : secondaryTeam,
        githubUrl: githubUrl.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        portfolioUrl: portfolioUrl.trim() || undefined,
        resumeFileName: resumeFileName || undefined,
        resumeDataUrl: resumeDataUrl || undefined,
        whyJoin: whyJoin.trim(),
        domainAnswers,
      });

      setSubmittedApp(created);
    } catch (err: any) {
      setErrorMessage(err?.message || "Application submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setSubmittedApp(null);
    setFullName("");
    setRegNumber("");
    setEmail("");
    setPhone("");
    setWhyJoin("");
    setGithubUrl("");
    setLinkedinUrl("");
    setPortfolioUrl("");
    setResumeFileName("");
    setResumeDataUrl("");
    setDomainAnswers({});
  };

  if (loading) {
    return (
      <div className="flex min-h-[450px] items-center justify-center">
        <div className="flex items-center gap-3 text-blue-600 font-mono">
          <RefreshCw className="size-5 animate-spin" />
          <span>Synchronizing Hiring Opportunities...</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUCCESS SCREEN
  // =========================================================================
  if (submittedApp) {
    return (
      <div className="hiring-success-wrapper max-w-3xl mx-auto px-4 py-8 animate-fadeIn">
        <div className="glass-card rounded-3xl p-6 md:p-10 border border-slate-200 text-center relative overflow-hidden bg-white/95 shadow-xl">
          <div className="absolute -top-24 -right-24 size-48 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-blue-50/60 blur-3xl pointer-events-none" />

          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 mb-5 shadow-sm">
            <CheckCircle2 className="size-8" />
          </div>

          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 mb-2">
            Application Received!
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-8">
            Thank you for applying to the Data Science Club Core Team. Your application has been logged
            and routed to the relevant domain leads for review.
          </p>

          {/* Reference Card */}
          <div className="max-w-md mx-auto rounded-2xl p-6 border border-slate-200 bg-slate-50/80 shadow-sm text-left relative mb-8">
            <span className="text-[10px] font-mono tracking-widest text-[#0052cc] uppercase block mb-1 font-semibold">
              RECRUITMENT APPLICATION TOKEN
            </span>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <span className="font-mono font-bold text-slate-900 text-base">{submittedApp.id}</span>
              <button
                type="button"
                onClick={handleCopyAppId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-blue-700 text-xs font-mono hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
              >
                {copiedId ? <Check className="size-3" /> : <Copy className="size-3" />}
                <span>{copiedId ? "Copied" : "Copy Ref"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">CANDIDATE</span>
                <span className="font-semibold text-slate-900">{submittedApp.fullName}</span>
                <span className="text-slate-500 block text-[10px]">{submittedApp.registrationNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">PRIMARY DOMAIN</span>
                <span className="font-semibold text-[#0052cc]">{submittedApp.primaryTeam}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SECONDARY DOMAIN</span>
                <span className="font-semibold text-slate-700">
                  {submittedApp.secondaryTeam || "None"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">STATUS</span>
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-blue-50 text-[#0052cc] border border-blue-200">
                  {submittedApp.status}
                </span>
              </div>
            </div>
          </div>

          {/* Social Share & Confirmation */}
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `🚀 I just submitted my application for the *Data Science Club Core Team* at VIT Bhopal! Preferred Domain: *${submittedApp.primaryTeam}*. Join the recruitment drive here: ${window.location.origin}/join`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs transition-all cursor-pointer shadow-sm"
            >
              <Share2 className="size-4" /> Share on WhatsApp
            </a>

            <button
              onClick={handleResetForAnother}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 font-bold text-xs transition-all cursor-pointer shadow-sm"
            >
              Submit Another Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN RECRUITMENT PORTAL VIEW
  // =========================================================================
  return (
    <div className="hiring-portal-wrapper max-w-5xl mx-auto px-4 py-8">
      {/* Hero Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0052cc] text-xs font-mono mb-3 shadow-xs">
          <span className="size-2 rounded-full bg-blue-600 animate-pulse" />
          <span>DATA SCIENCE CLUB CORE TEAM RECRUITMENT 2026</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-extrabold text-slate-900 tracking-tight mb-4">
          Architect The <span className="text-[#0052cc]">Future of Data</span>
        </h1>
        <p className="text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
          We build machine learning pipelines, engineer distributed systems, design distinctive visual
          identities, and organize the university's flagship hackathons.
        </p>

        {/* Live Status & Deadline Countdown */}
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-4 p-3.5 rounded-2xl bg-white/95 border border-slate-200 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${
                isHiringOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span
              className={`text-xs font-mono font-bold uppercase tracking-wider ${
                isHiringOpen ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {isHiringOpen ? "Applications Live" : "Recruitments Closed"}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
            <Clock className="size-3.5 text-[#0052cc]" />
            <span>Deadline Countdown:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {timeLeft.days}d : {timeLeft.hours}h : {timeLeft.minutes}m : {timeLeft.seconds}s
            </span>
          </div>
        </div>
      </div>

      {/* Closed Recruitment Notice */}
      {!isHiringOpen && (
        <div className="mb-10 p-8 rounded-3xl bg-rose-50 border border-rose-200 text-center">
          <AlertCircle className="size-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-rose-800 mb-2">Applications Are Currently Closed</h3>
          <p className="text-xs text-slate-600 max-w-lg mx-auto">
            The deadline for this recruitment cycle has passed or recruitments have been paused by the
            executive board. Follow our social channels for announcements on future opportunities!
          </p>
        </div>
      )}

      {/* Domain Explorer Tabs */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
            <span>Explore Open Domains</span>
            <span className="text-xs font-mono font-normal text-slate-500">
              ({domains.length} Specialized Teams)
            </span>
          </h2>
        </div>

        {/* Domain Navigation Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
          {domains.map((dom) => {
            const isSelected = activeTabDomain === dom.domainName;
            return (
              <button
                key={dom.id}
                type="button"
                onClick={() => setActiveTabDomain(dom.domainName)}
                className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? "bg-blue-50 border-blue-500 shadow-sm"
                    : "bg-white/95 border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
                }`}
              >
                <div className="mb-3">{DOMAIN_ICONS[dom.domainName] || <Code2 className="size-5" />}</div>
                <span className="font-bold text-xs text-slate-900 block leading-tight">
                  {dom.domainName}
                </span>
                <span className="text-[10px] font-mono text-[#0052cc] mt-1 flex items-center gap-1 font-semibold">
                  View Scope <ChevronRight className="size-3" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Domain Spotlight Card */}
        {currentTabDomain && (
          <div className="glass-card rounded-3xl p-6 md:p-8 border border-slate-200 bg-white/95 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                  {DOMAIN_ICONS[currentTabDomain.domainName]}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{currentTabDomain.domainName}</h3>
                  <span className="text-xs text-slate-500">{currentTabDomain.shortDescription}</span>
                </div>
              </div>

              {/* 1-Click Select as Choice */}
              {isHiringOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryTeam(currentTabDomain.domainName);
                    // scroll to form
                    document.getElementById("apply-form")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
                >
                  <span>Select as 1st Choice</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6 max-w-3xl">
              {currentTabDomain.fullDescription}
            </p>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-2 font-semibold">
                KEY TECHNOLOGIES & TOOLS IN THIS TEAM:
              </span>
              <div className="flex flex-wrap gap-2">
                {currentTabDomain.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 rounded-full text-xs font-mono bg-slate-50 border border-slate-200 text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* APPLICATION FORM (Only when open) */}
      {isHiringOpen && (
        <div id="apply-form" className="glass-card rounded-3xl p-6 md:p-10 border border-slate-200 bg-white/95 shadow-md">
          <div className="border-b border-slate-200 pb-6 mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-[#0052cc] block mb-1 font-semibold">
              OFFICIAL APPLICATION INTAKE
            </span>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Submit Your Core Team Application
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Ensure all university credentials and portfolio links are accurate. You may select a 1st
              and optional 2nd choice team.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-shake">
              <AlertCircle className="size-5 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Identity */}
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 block mb-3 font-semibold">
                1. APPLICANT IDENTITY
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">Full Name *</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">Registration / Roll No. *</label>
                  <input
                    type="text"
                    placeholder="e.g. 24BAI10042"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-slate-200 text-slate-900 font-mono rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">VIT Bhopal Email ID *</label>
                  <input
                    type="email"
                    placeholder="student.2024@vitbhopal.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">WhatsApp / Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">Branch / Degree *</label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">Academic Year *</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Preferred Domains */}
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 block mb-3 font-semibold">
                2. TEAM PREFERENCES
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">
                    1st Choice Team (Primary Role) *
                  </label>
                  <select
                    value={primaryTeam}
                    onChange={(e) => setPrimaryTeam(e.target.value as LeadDomain)}
                    className="w-full bg-white border border-blue-300 text-blue-700 font-semibold rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                    required
                  >
                    {domains.map((dom) => (
                      <option key={dom.id} value={dom.domainName}>
                        {dom.domainName}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Your dynamic questions below will be tailored to this selection.
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">
                    2nd Choice Team (Secondary / Fallback)
                  </label>
                  <select
                    value={secondaryTeam}
                    onChange={(e) => setSecondaryTeam(e.target.value as LeadDomain | "None")}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                  >
                    <option value="None">None (1st Choice Only)</option>
                    {domains
                      .filter((d) => d.domainName !== primaryTeam)
                      .map((dom) => (
                        <option key={dom.id} value={dom.domainName}>
                          {dom.domainName}
                        </option>
                      ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    If positions are full in your 1st choice, you will be considered here.
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Dynamic Domain-Specific Questions */}
            {primaryDomainConfig && primaryDomainConfig.questions.length > 0 && (
              <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-xs">
                <span className="text-xs font-mono uppercase tracking-widest text-[#0052cc] block mb-3 flex items-center gap-1.5 font-bold">
                  <HelpCircle className="size-4" /> 3. DOMAIN SPECIFIC QUESTIONS ({primaryTeam})
                </span>

                <div className="space-y-4">
                  {primaryDomainConfig.questions.map((q) => (
                    <div key={q.id}>
                      <label className="text-xs text-slate-800 block mb-1.5 font-medium">
                        {q.label} {q.required && <span className="text-blue-600">*</span>}
                      </label>
                      {q.type === "textarea" ? (
                        <textarea
                          rows={3}
                          placeholder={q.placeholder}
                          value={domainAnswers[q.id] || ""}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none leading-relaxed shadow-xs transition-all"
                          required={q.required}
                        />
                      ) : (
                        <input
                          type={q.type}
                          placeholder={q.placeholder}
                          value={domainAnswers[q.id] || ""}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                          required={q.required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Statement of Purpose & Links */}
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 block mb-3 font-semibold">
                4. STATEMENT OF PURPOSE & WORK SAMPLES
              </span>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">
                    Why do you want to join Data Science Club VIT Bhopal? *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tell us what excites you about the club, any prior contributions, and what you wish to learn or build..."
                    value={whyJoin}
                    onChange={(e) => setWhyJoin(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none leading-relaxed shadow-xs transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-700 block mb-1.5 font-medium">GitHub URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://github.com/..."
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 block mb-1.5 font-medium">LinkedIn URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/..."
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 block mb-1.5 font-medium">
                      Portfolio / Behance / Link (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://portfolio.me"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                    />
                  </div>
                </div>

                {/* Resume Upload Drop-zone */}
                <div>
                  <label className="text-xs text-slate-700 block mb-1.5 font-medium">
                    Attach Resume / Portfolio PDF (Optional, max 5MB)
                  </label>
                  <label className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/30 transition-colors cursor-pointer text-center">
                    <Upload className="size-6 text-[#0052cc] mb-2" />
                    {resumeFileName ? (
                      <span className="text-xs text-blue-700 font-mono font-bold">
                        Attached: {resumeFileName}
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-slate-900 font-medium">
                          Click to upload or drag & drop PDF resume
                        </span>
                        <span className="text-[10px] text-slate-500 mt-1">PDF format only</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleResumeUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Toolbar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Submissions are reviewed directly by the DSC Executive Board and Domain Leads.
              </span>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Transmitting Application...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Application</span>
                    <Send className="size-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default HiringPortal;
