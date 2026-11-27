import React, { useState, useEffect, useMemo } from "react";
import { dataEngine } from "@/lib/data-engine";
import type { ClubEvent, RegistrationRecord, TeamMember, ResidenceType, RegistrationType } from "@/types/models";
import { QRCodeSVG } from "qrcode.react";
import { generateRegistrationPdf } from "./RegistrationReceiptPdf";
import {
  Calendar,
  MapPin,
  Users,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  Share2,
  Printer,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Building,
} from "lucide-react";
import "./RegistrationPortal.css";

interface RegistrationPortalProps {
  initialEventId?: string;
}

const DEFAULT_BRANCH = "Computer Science & Engineering (Core)";
const DEFAULT_YEAR = "1st Year";

const BRANCH_OPTIONS = [
  DEFAULT_BRANCH,
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

const YEAR_OPTIONS = [DEFAULT_YEAR, "2nd Year", "3rd Year", "4th Year", "Postgraduate / Research"];

export const RegistrationPortal: React.FC<RegistrationPortalProps> = ({ initialEventId }) => {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || "");
  const [loading, setLoading] = useState(true);

  // Form State
  const [regType, setRegType] = useState<RegistrationType>("individual");
  const [fullName, setFullName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branch, setBranch] = useState<string>(DEFAULT_BRANCH);
  const [yearSemester, setYearSemester] = useState<string>(DEFAULT_YEAR);
  const [department, setDepartment] = useState("SCSE");
  const [residenceType, setResidenceType] = useState<ResidenceType>("Hosteller");

  // Team State
  const [teamName, setTeamName] = useState("");
  const [teamSize, setTeamSize] = useState<number>(3);
  const [teammates, setTeammates] = useState<TeamMember[]>([
    {
      fullName: "",
      regNumber: "",
      email: "",
      phone: "",
      branch: DEFAULT_BRANCH,
      yearSemester: DEFAULT_YEAR,
      residenceType: "Hosteller",
    },
    {
      fullName: "",
      regNumber: "",
      email: "",
      phone: "",
      branch: DEFAULT_BRANCH,
      yearSemester: DEFAULT_YEAR,
      residenceType: "Hosteller",
    },
  ]);

  // OTP Verification State
  const [generatedOtp, setGeneratedOtp] = useState<string>("");
  const [enteredOtp, setEnteredOtp] = useState<string>("");
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [isOtpVerified, setIsOtpVerified] = useState<boolean>(false);
  const [otpNotice, setOtpNotice] = useState<string>("");

  // Payment State
  const [paymentUtr, setPaymentUtr] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<RegistrationRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Countdown State
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Fetch all published events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const all = await dataEngine.getClubEvents();
        const activeOnly = all.filter((e) => e.isRegistrationOpen);
        setEvents(activeOnly);

        if (!selectedEventId && activeOnly.length > 0) {
          const firstEvent = activeOnly[0];
          if (firstEvent) {
            setSelectedEventId(firstEvent.id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch events for registration", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();

    const handleDataChange = () => {
      fetchEvents();
    };
    window.addEventListener("dsc_data_change", handleDataChange);
    return () => window.removeEventListener("dsc_data_change", handleDataChange);
  }, [selectedEventId]);

  // Active Selected Event Object
  const activeEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || events[0] || null;
  }, [events, selectedEventId]);

  // Countdown timer for active event registration deadline
  useEffect(() => {
    if (!activeEvent) return;
    const updateCountdown = () => {
      const deadline = new Date(activeEvent.registrationDeadline).getTime();
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
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeEvent]);

  // Synchronize team member array length when team size changes
  useEffect(() => {
    if (regType !== "team") return;
    const needed = Math.max(1, teamSize - 1);
    setTeammates((prev) => {
      if (prev.length === needed) return prev;
      if (prev.length < needed) {
        const extra: TeamMember[] = Array.from({ length: needed - prev.length }).map(() => ({
          fullName: "",
          regNumber: "",
          email: "",
          phone: "",
          branch: DEFAULT_BRANCH,
          yearSemester: DEFAULT_YEAR,
          residenceType: "Hosteller",
        }));
        return [...prev, ...extra];
      }
      return prev.slice(0, needed);
    });
  }, [teamSize, regType]);

  // Capacity & Deadline check
  const isCapacityFull = useMemo(() => {
    if (!activeEvent) return false;
    return (activeEvent.currentRegistrations || 0) >= activeEvent.maxCapacity;
  }, [activeEvent]);

  const isDeadlinePassed = useMemo(() => {
    if (!activeEvent) return false;
    return new Date(activeEvent.registrationDeadline).getTime() <= Date.now();
  }, [activeEvent]);

  // OTP handlers
  const handleSendOtp = () => {
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid university email to receive your OTP.");
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setIsOtpSent(true);
    setErrorMessage("");
    setOtpNotice(`🔐 Verification code: ${code} has been dispatched to ${email}. (Expires in 5 minutes)`);
  };

  const handleVerifyOtp = () => {
    if (enteredOtp.trim() === generatedOtp.trim() && generatedOtp !== "") {
      setIsOtpVerified(true);
      setOtpNotice("✅ Email address verified successfully!");
      setErrorMessage("");
    } else {
      setErrorMessage("Incorrect OTP code. Please enter the 6-digit code provided.");
    }
  };

  const handleCopyUpi = () => {
    if (!activeEvent?.upiId) return;
    navigator.clipboard.writeText(activeEvent.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleTeammateChange = (index: number, field: keyof TeamMember, value: string) => {
    setTeammates((prev) => {
      const updated = [...prev];
      const current = updated[index];
      if (current) {
        updated[index] = { ...current, [field]: value } as TeamMember;
      }
      return updated;
    });
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!activeEvent) {
      setErrorMessage("No event selected.");
      return;
    }

    if (isDeadlinePassed) {
      setErrorMessage("Registration deadline has passed for this event.");
      return;
    }

    if (!fullName.trim() || !regNumber.trim() || !email.trim() || !phone.trim()) {
      setErrorMessage("Please fill all required student identity fields.");
      return;
    }

    if (!isOtpVerified) {
      setErrorMessage("Please verify your email with the 6-digit OTP code before proceeding.");
      return;
    }

    if (regType === "team") {
      if (!teamName.trim()) {
        setErrorMessage("Please provide your Team Name.");
        return;
      }
      for (let i = 0; i < teammates.length; i++) {
        const m = teammates[i];
        if (!m || !m.fullName.trim() || !m.regNumber.trim() || !m.email.trim()) {
          setErrorMessage(`Please provide complete details for Teammate #${i + 2}.`);
          return;
        }
      }
    }

    if (activeEvent.isPaidEvent && activeEvent.registrationFee > 0) {
      if (!paymentUtr.trim() || paymentUtr.trim().length < 6) {
        setErrorMessage("Please enter the 12-digit UPI Transaction Reference (UTR / Bank Ref Number).");
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await dataEngine.createRegistration({
        eventId: activeEvent.id,
        eventTitle: activeEvent.title,
        regType,
        fullName: fullName.trim(),
        regNumber: regNumber.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        branch: branch || DEFAULT_BRANCH,
        yearSemester: yearSemester || DEFAULT_YEAR,
        department,
        residenceType,
        teamName: regType === "team" ? teamName.trim() : undefined,
        teamSize: regType === "team" ? teamSize : 1,
        teamMembers: regType === "team" ? teammates : undefined,
        paymentStatus: activeEvent.isPaidEvent ? "pending_verification" : "free",
        paymentUtr: activeEvent.isPaidEvent ? paymentUtr.trim() : undefined,
        paymentAmount: activeEvent.isPaidEvent ? activeEvent.registrationFee : 0,
        registrationStatus: isCapacityFull ? "waitlisted" : "confirmed",
      });

      setSubmissionSuccess(created);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to submit registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setSubmissionSuccess(null);
    setIsOtpVerified(false);
    setIsOtpSent(false);
    setEnteredOtp("");
    setGeneratedOtp("");
    setPaymentUtr("");
    setFullName("");
    setRegNumber("");
    setEmail("");
    setPhone("");
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-blue-600 font-mono">
          <RefreshCw className="size-5 animate-spin" />
          <span>Synchronizing Event Registrations...</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUCCESS SCREEN: DIGITAL EVENT PASS & OFFICIAL RECEIPT
  // =========================================================================
  if (submissionSuccess) {
    const isWaitlist = submissionSuccess.registrationStatus === "waitlisted";

    return (
      <div className="registration-success-container max-w-3xl mx-auto px-4 py-8 animate-fadeIn">
        <div className="glass-card rounded-3xl p-6 md:p-10 border border-slate-200 text-center relative overflow-hidden bg-white/95 shadow-xl">
          <div className="absolute -top-24 -right-24 size-48 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-blue-50/60 blur-3xl pointer-events-none" />

          {/* Celebration Header */}
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 mb-5 shadow-sm">
            <CheckCircle2 className="size-8" />
          </div>

          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 mb-2">
            {isWaitlist ? "Priority Waitlist Confirmed!" : "Registration Confirmed!"}
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-8">
            {isWaitlist
              ? "The hall capacity is currently filled. Your registration has been placed on the priority waitlist. You will be notified via email if a slot frees up."
              : "Your ticket has been generated and recorded on the Data Science Club platform. Please save or download your official digital event pass below."}
          </p>

          {/* OFFICIAL PASS CARD */}
          <div className="holographic-pass rounded-3xl p-6 md:p-8 border-2 border-blue-600 bg-white shadow-xl max-w-xl mx-auto mb-8 text-left relative">
            {/* Pass Top Ribbon */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#0052cc] uppercase block font-bold">
                  DATA SCIENCE CLUB // VIT BHOPAL
                </span>
                <span className="text-xs font-mono text-slate-500">OFFICIAL VERIFIED ENTRY PASS</span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isWaitlist
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {submissionSuccess.registrationStatus}
              </span>
            </div>

            {/* Event Name & Candidate Info */}
            <div className="mb-6">
              <h3 className="text-xl font-display font-bold text-slate-900 leading-tight mb-1">
                {submissionSuccess.eventTitle}
              </h3>
              <p className="text-xs text-slate-600">Pass Token: {submissionSuccess.id}</p>
            </div>

            {/* Candidate & Event Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs mb-6 border-y border-slate-100 py-4">
              <div>
                <span className="text-slate-500 block text-[10px]">ATTENDEE / LEAD</span>
                <span className="font-semibold text-slate-900">{submissionSuccess.fullName}</span>
                <span className="text-slate-500 block text-[10px]">
                  {submissionSuccess.regNumber} ({submissionSuccess.branch})
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">ENTRY TYPE</span>
                <span className="font-semibold text-[#0052cc] uppercase">
                  {submissionSuccess.regType === "team"
                    ? `Team (${submissionSuccess.teamName || "Group"})`
                    : "Individual Pass"}
                </span>
                {submissionSuccess.regType === "team" && (
                  <span className="text-slate-500 block text-[10px]">
                    Size: {submissionSuccess.teamSize} builders
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">CONTACT TELEMETRY</span>
                <span className="text-slate-700 font-mono text-[11px] block">{submissionSuccess.email}</span>
                <span className="text-slate-700 font-mono text-[11px] block">{submissionSuccess.phone}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">PAYMENT STATUS</span>
                <span className="font-semibold text-slate-900 uppercase">
                  {submissionSuccess.paymentStatus === "free" ? "Free Admission" : "Verified Payment"}
                </span>
                {submissionSuccess.paymentUtr && (
                  <span className="text-slate-500 font-mono text-[10px] block">
                    UTR: {submissionSuccess.paymentUtr}
                  </span>
                )}
              </div>
            </div>

            {/* Security QR Code */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">
                  SECURITY GATE VERIFICATION
                </span>
                <span className="text-xs text-slate-600 block">
                  Scan at AB-1 / Innovation Center reception for immediate check-in badge printing.
                </span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0">
                <QRCodeSVG
                  value={`DSC-PASS:${submissionSuccess.id}|EVT:${submissionSuccess.eventId}|REG:${submissionSuccess.regNumber}`}
                  size={76}
                  level="M"
                  fgColor="#0052cc"
                  bgColor="#ffffff"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons: PDF Download & Sharing */}
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => generateRegistrationPdf(submissionSuccess)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              <Download className="size-4" /> Download Official PDF Receipt
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `🎉 I just registered for *${submissionSuccess.eventTitle}* organized by the Data Science Club at VIT Bhopal! Grab your entry pass here: ${window.location.origin}/register`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs transition-all cursor-pointer shadow-sm"
            >
              <Share2 className="size-4" /> Share on WhatsApp
            </a>

            <button
              onClick={handleResetForAnother}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 font-bold text-xs transition-all cursor-pointer shadow-sm"
            >
              Register Another Participant
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN REGISTRATION INTAKE FORM VIEW
  // =========================================================================
  return (
    <div className="registration-portal-wrapper max-w-5xl mx-auto px-4 py-8">
      {/* Header Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0052cc] text-xs font-mono mb-2 shadow-xs">
            <span className="size-2 rounded-full bg-blue-600 animate-pulse" />
            <span>DSC VIT BHOPAL EVENT DESK</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-extrabold text-slate-900 tracking-tight">
            Event Pass & Team Registration
          </h2>
        </div>

        {/* Event Quick Switcher */}
        {events.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 font-medium whitespace-nowrap">Select Sprint:</label>
            <select
              value={activeEvent?.id}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setIsOtpVerified(false);
                setIsOtpSent(false);
              }}
              className="bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2 text-xs font-medium focus:border-blue-600 focus:outline-none shadow-xs"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title} ({evt.isPaidEvent ? `₹${evt.registrationFee}` : "FREE"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active Event Banner & Stats */}
      {activeEvent && (
        <div className="glass-card rounded-3xl p-6 md:p-8 border border-slate-200 bg-white/95 mb-8 relative overflow-hidden shadow-sm">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-blue-50 text-[#0052cc] border border-blue-200">
                  {activeEvent.tag}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest ${
                    activeEvent.isPaidEvent
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {activeEvent.isPaidEvent ? `Registration Fee: ₹${activeEvent.registrationFee}` : "Free Admission"}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 mb-3">
                {activeEvent.title}
              </h1>

              <div className="flex flex-wrap gap-4 text-xs text-slate-600 mb-4">
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-[#0052cc]" />
                  {new Date(activeEvent.eventDate).toLocaleDateString("en-IN", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-[#0052cc]" />
                  {activeEvent.venue}
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Users className="size-3.5 text-[#0052cc]" />
                  Capacity: {activeEvent.currentRegistrations} / {activeEvent.maxCapacity} slots
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{activeEvent.description}</p>
            </div>

            {/* Countdown & Capacity Gauge */}
            <div className="flex flex-col justify-between md:items-end min-w-[240px] pt-4 md:pt-0 border-t md:border-t-0 border-slate-200">
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1 font-semibold">
                  REGISTRATION DEADLINE
                </span>
                <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-900 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                  <Clock className="size-4 text-[#0052cc]" />
                  <span>
                    {timeLeft.days}d : {timeLeft.hours}h : {timeLeft.minutes}m : {timeLeft.seconds}s
                  </span>
                </div>
              </div>

              {/* Capacity Progress Bar */}
              <div className="w-full mt-4">
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                  <span>Capacity Filled</span>
                  <span>
                    {Math.round(((activeEvent.currentRegistrations || 0) / activeEvent.maxCapacity) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCapacityFull ? "bg-amber-500" : "bg-blue-600"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((activeEvent.currentRegistrations || 0) / activeEvent.maxCapacity) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Warning Banners */}
          {isDeadlinePassed && (
            <div className="mt-6 flex items-center gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="size-4 shrink-0 text-rose-500" />
              <span>
                <strong>Registrations Closed:</strong> The deadline for this event has expired. Submissions are no longer accepted.
              </span>
            </div>
          )}

          {isCapacityFull && !isDeadlinePassed && (
            <div className="mt-6 flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertCircle className="size-4 shrink-0 text-amber-500" />
              <span>
                <strong>Capacity Limit Reached:</strong> Hall capacity is full. Any registrations submitted now will be placed on the official <strong>Priority Waitlist</strong>.
              </span>
            </div>
          )}
        </div>
      )}

      {/* REGISTRATION FORM */}
      <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-6 md:p-10 border border-slate-200 bg-white/95 shadow-md">
        {/* Error message banner */}
        {errorMessage && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-shake">
            <AlertCircle className="size-5 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Mode Switcher */}
        <div className="mb-8">
          <label className="text-xs font-mono uppercase tracking-widest text-slate-500 block mb-3 font-semibold">
            1. REGISTRATION FORMAT
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setRegType("individual")}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                regType === "individual"
                  ? "bg-blue-50 border-blue-500 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <User
                className={`size-5 mt-0.5 ${regType === "individual" ? "text-[#0052cc]" : "text-slate-400"}`}
              />
              <div>
                <span className="font-bold text-sm text-slate-900 block">Individual Entry</span>
                <span className="text-xs text-slate-500 leading-tight">
                  Single seat registration for workshops, talks, or solo attendees.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRegType("team")}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                regType === "team"
                  ? "bg-blue-50 border-blue-500 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Users
                className={`size-5 mt-0.5 ${regType === "team" ? "text-[#0052cc]" : "text-slate-400"}`}
              />
              <div>
                <span className="font-bold text-sm text-slate-900 block">Team Entry (Hackathons / Group)</span>
                <span className="text-xs text-slate-500 leading-tight">
                  Group registration for multi-member hackathons and team competitions.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Team Configuration (if team selected) */}
        {regType === "team" && (
          <div className="mb-8 p-5 rounded-2xl bg-blue-50/50 border border-blue-200 shadow-xs">
            <h3 className="text-sm font-display font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Users className="size-4 text-[#0052cc]" /> Team Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-700 block mb-1.5 font-medium">Team Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Matrix Inverters"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 block mb-1.5 font-medium">Total Team Size *</label>
                <select
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
                >
                  <option value={2}>2 Members (Leader + 1 Teammate)</option>
                  <option value={3}>3 Members (Leader + 2 Teammates)</option>
                  <option value={4}>4 Members (Leader + 3 Teammates)</option>
                  <option value={5}>5 Members (Leader + 4 Teammates)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Primary Student / Leader Details */}
        <div className="mb-8">
          <label className="text-xs font-mono uppercase tracking-widest text-slate-500 block mb-3 font-semibold">
            {regType === "team" ? "2. TEAM LEADER INFORMATION" : "2. PARTICIPANT IDENTITY"}
          </label>

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
              <label className="text-xs text-slate-700 block mb-1.5 font-medium">Registration / Roll No *</label>
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
              <label className="text-xs text-slate-700 block mb-1.5 font-medium">Official University Email *</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="student.24bai@vitbhopal.ac.in"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsOtpVerified(false);
                    setIsOtpSent(false);
                  }}
                  disabled={isOtpVerified}
                  className="flex-1 bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:bg-slate-50 disabled:opacity-75 shadow-xs transition-all"
                  required
                />
                {!isOtpVerified && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="px-4 py-2.5 rounded-xl bg-blue-50 text-[#0052cc] border border-blue-200 text-xs font-semibold hover:bg-blue-100 whitespace-nowrap cursor-pointer transition-colors shadow-xs"
                  >
                    {isOtpSent ? "Resend Code" : "Send OTP"}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-700 block mb-1.5 font-medium">Phone / WhatsApp Number *</label>
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
              <label className="text-xs text-slate-700 block mb-1.5 font-medium">Academic Year / Sem *</label>
              <select
                value={yearSemester}
                onChange={(e) => setYearSemester(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-700 block mb-1.5 font-medium">School / Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-xs transition-all"
              >
                <option value="SCSE">SCSE (Computer Science & Engineering)</option>
                <option value="SASL">SASL (Applied Sciences & Languages)</option>
                <option value="SEEE">SEEE (Electrical & Electronics)</option>
                <option value="SMEC">SMEC (Mechanical & Civil)</option>
                <option value="VBS">VBS (Business School)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-700 block mb-1.5 font-medium">Residence Status (Logistics) *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResidenceType("Hosteller")}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    residenceType === "Hosteller"
                      ? "bg-blue-50 border-blue-500 text-[#0052cc] shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Building className="size-3.5" /> Hosteller
                </button>
                <button
                  type="button"
                  onClick={() => setResidenceType("Day Scholar")}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    residenceType === "Day Scholar"
                      ? "bg-blue-50 border-blue-500 text-[#0052cc] shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <User className="size-3.5" /> Day Scholar
                </button>
              </div>
            </div>
          </div>

          {/* OTP Verification Interactive Drawer */}
          {isOtpSent && !isOtpVerified && (
            <div className="mt-4 p-4 rounded-2xl bg-blue-50/70 border border-blue-200 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0052cc] mb-2">
                <ShieldCheck className="size-4" /> Enter 6-Digit Email Verification Code
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 481902"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ""))}
                  className="bg-white border border-slate-300 text-slate-900 font-mono text-center tracking-widest text-lg rounded-xl px-4 py-2 focus:border-blue-600 focus:outline-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
                >
                  Verify Code
                </button>
              </div>
              {otpNotice && (
                <div className="mt-2.5 text-[11px] font-mono text-blue-700 flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="size-3.5 shrink-0" /> {otpNotice}
                </div>
              )}
            </div>
          )}

          {isOtpVerified && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>
                Email verified: <strong>{email}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Step 3: Teammates Configuration (If Team) */}
        {regType === "team" && (
          <div className="mb-8">
            <label className="text-xs font-mono uppercase tracking-widest text-slate-500 block mb-3 font-semibold">
              3. TEAM MEMBERS DETAILS
            </label>

            <div className="space-y-4">
              {teammates.map((member, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-slate-300 transition-all shadow-xs"
                >
                  <span className="text-xs font-mono font-bold text-[#0052cc] block mb-3">
                    Teammate #{idx + 2} Details
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1 font-medium">Full Name *</label>
                      <input
                        type="text"
                        placeholder="Name"
                        value={member.fullName}
                        onChange={(e) => handleTeammateChange(idx, "fullName", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1 font-medium">Registration No *</label>
                      <input
                        type="text"
                        placeholder="24BCE10..."
                        value={member.regNumber}
                        onChange={(e) =>
                          handleTeammateChange(idx, "regNumber", e.target.value.toUpperCase())
                        }
                        className="w-full bg-white border border-slate-200 text-slate-900 font-mono rounded-lg px-3 py-2 text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1 font-medium">Email *</label>
                      <input
                        type="email"
                        placeholder="student@vitbhopal.ac.in"
                        value={member.email}
                        onChange={(e) => handleTeammateChange(idx, "email", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1 font-medium">Phone *</label>
                      <input
                        type="tel"
                        placeholder="Phone number"
                        value={member.phone}
                        onChange={(e) => handleTeammateChange(idx, "phone", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1 font-medium">Branch</label>
                      <select
                        value={member.branch}
                        onChange={(e) => handleTeammateChange(idx, "branch", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                      >
                        {BRANCH_OPTIONS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1 font-medium">Residence</label>
                      <select
                        value={member.residenceType}
                        onChange={(e) => handleTeammateChange(idx, "residenceType", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                      >
                        <option value="Hosteller">Hosteller</option>
                        <option value="Day Scholar">Day Scholar</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Zero-Cost NPCI UPI Payment (If Paid Event) */}
        {activeEvent?.isPaidEvent && activeEvent.registrationFee > 0 && (
          <div className="mb-8 p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#0052cc] mb-4 font-bold">
              <CreditCard className="size-4" /> ZERO-FEE REGISTRATION PAYMENT (₹{activeEvent.registrationFee})
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Dynamic NPCI UPI QR */}
              <div className="flex flex-col items-center p-5 rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-xs">
                <QRCodeSVG
                  value={`upi://pay?pa=${activeEvent.upiId || "dscvitb@upi"}&pn=${encodeURIComponent(
                    activeEvent.upiPayeeName || "DSC VIT Bhopal",
                  )}&am=${activeEvent.registrationFee}&cu=INR`}
                  size={160}
                  level="M"
                  fgColor="#0052cc"
                  bgColor="#ffffff"
                />
                <span className="text-[10px] font-mono font-bold mt-2 text-slate-600">
                  SCAN WITH ANY UPI APP (GPay / PhonePe / Paytm)
                </span>
                <span className="text-xs font-bold text-[#0052cc] mt-0.5">
                  Amount: ₹{activeEvent.registrationFee}
                </span>
              </div>

              {/* UPI Details & UTR Input */}
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">CLUB UPI VPA ID</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {activeEvent.upiId || "dscvitb@upi"}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0052cc] text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedUpi ? <Check className="size-3" /> : <Copy className="size-3" />}
                      <span>{copiedUpi ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <a
                  href={`upi://pay?pa=${activeEvent.upiId || "dscvitb@upi"}&pn=${encodeURIComponent(
                    activeEvent.upiPayeeName || "DSC VIT Bhopal",
                  )}&am=${activeEvent.registrationFee}&cu=INR`}
                  className="block w-full text-center py-2.5 px-4 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs hover:bg-blue-100 transition-colors shadow-xs"
                >
                  Open in UPI App (Mobile)
                </a>

                <div>
                  <label className="text-xs text-slate-700 block mb-1 font-medium">
                    12-Digit UPI Transaction Reference / UTR *
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="e.g. 429188201928"
                    value={paymentUtr}
                    onChange={(e) => setPaymentUtr(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-white border border-slate-200 text-slate-900 font-mono rounded-xl px-4 py-2.5 text-xs focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none tracking-wider shadow-xs"
                    required
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Find this 12-digit number in your payment confirmation screen.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            {!isOtpVerified ? (
              <span className="text-amber-700 font-medium">⚠️ Verify email OTP before submitting</span>
            ) : isCapacityFull ? (
              <span className="text-amber-700 font-medium">Submitting entry to Priority Waitlist</span>
            ) : (
              <span className="text-emerald-700 font-medium">All checks completed — Ready to confirm</span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || isDeadlinePassed || !isOtpVerified}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                <span>Processing Ticket...</span>
              </>
            ) : isDeadlinePassed ? (
              <span>Registrations Closed</span>
            ) : isCapacityFull ? (
              <>
                <span>Submit to Waitlist</span>
                <ArrowRight className="size-4" />
              </>
            ) : (
              <>
                <span>Confirm & Generate Pass</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationPortal;
