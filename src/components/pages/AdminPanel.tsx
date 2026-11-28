import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FirebaseConfigNotice } from "@/components/auth/FirebaseConfigNotice";
import type { RoleType, LeadDomain } from "@/types/models";
import { AdminDashboardOverview } from "@/components/admin/AdminDashboardOverview";
import { RegistrationsAdminView } from "@/components/admin/RegistrationsAdminView";
import { HiringAdminView } from "@/components/hiring/HiringAdminView";
import { TeamLeadManager } from "@/components/admin/TeamLeadManager";
import { ActivityLogView } from "@/components/admin/ActivityLogView";
import { DatabaseBackupView } from "@/components/admin/DatabaseBackupView";
import { FinanceSectionView } from "@/components/finance/FinanceSectionView";
import { FacultyOversightView } from "@/components/faculty/FacultyOversightView";
import { EventsAdminView } from "@/components/events/EventsAdminView";
import {
  ShieldCheck,
  Crown,
  GraduationCap,
  Users,
  LayoutDashboard,
  Calendar,
  Ticket,
  Briefcase,
  History,
  Settings,
  LogOut,
  RefreshCw,
  Lock,
  Wallet,
  AlertCircle,
} from "lucide-react";
import "./AdminPanel.css";

export const AdminPanel: React.FC = () => {
  const {
    user,
    role,
    leadDomain,
    title,
    isConfigured,
    loading,
    error: authError,
    signInWithGoogle,
    signOut,
    refreshClaims,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [refreshingClaims, setRefreshingClaims] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string>("");

  // 1. Unconfigured Environment State
  if (!isConfigured) {
    return <FirebaseConfigNotice />;
  }

  // 2. Loading Session State
  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-3 text-cyan-400 font-mono text-xs">
          <RefreshCw className="size-4 animate-spin" />
          <span>Validating Administrator Credentials...</span>
        </div>
      </div>
    );
  }

  // Handle Google Sign-in action
  const handleGoogleSignIn = async () => {
    setLocalError("");
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr?.code !== "auth/popup-closed-by-user") {
        setLocalError(firebaseErr?.message || "Failed to sign in with Google.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  // 3. Unauthenticated State (Prompt Google Sign-In)
  if (!user) {
    return (
      <div className="admin-page-container flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-xl relative text-left">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4">
            <Lock className="size-6" />
          </div>

          <h2 className="text-2xl font-display font-bold text-white mb-1">
            DSC Club Management Panel
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Restricted to Executive Board, Faculty Coordinator, and Domain Leads.
          </p>

          {(localError || authError) && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
              <span>{localError || authError}</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {signingIn ? (
                <>
                  <RefreshCw className="size-4 animate-spin text-slate-950" />
                  <span>Connecting with Google...</span>
                </>
              ) : (
                <>
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with University Google Account</span>
                </>
              )}
            </button>

            <div className="pt-4 border-t border-white/10 text-[11px] text-slate-400 leading-relaxed">
              <span className="text-cyan-400 font-mono font-semibold block mb-1">
                🔒 Cryptographic RBAC Verification
              </span>
              Access requires pre-authorized custom claims issued by the Club Executive Board. General club members are denied access to management routes.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated but Unauthorized Member State
  if (role === "member") {
    return (
      <div className="admin-page-container flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900/90 border border-rose-500/30 shadow-2xl backdrop-blur-xl relative text-left">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4">
            <Lock className="size-6" />
          </div>

          <h2 className="text-2xl font-display font-bold text-white mb-2">
            Access Denied
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Signed in as <strong className="text-white">{user.email}</strong>.
          </p>
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mb-6 leading-relaxed">
            This university account does not possess assigned management panel privileges. If a Super Admin just granted your role, refresh your permissions or sign out and sign back in to activate your updated token.
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={refreshingClaims}
              onClick={async () => {
                setRefreshingClaims(true);
                try {
                  await refreshClaims();
                } finally {
                  setRefreshingClaims(false);
                }
              }}
              className="w-full py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${refreshingClaims ? "animate-spin" : ""}`} />
              <span>{refreshingClaims ? "Refreshing Token..." : "Refresh Permissions"}</span>
            </button>

            <button
              type="button"
              onClick={signOut}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out &amp; Try Another Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Authorized Panel Member
  const isSuperAdmin = role === "super_admin";
  const isFaculty = role === "faculty_coordinator";
  const isTeamLead = role === "team_lead";
  const currentUserEmail = user.email || "";

  return (
    <div className="admin-page-container max-w-6xl mx-auto px-4 py-8">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isSuperAdmin
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : isFaculty
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
              }`}
            >
              {isSuperAdmin && <Crown className="size-3" />}
              {isFaculty && <GraduationCap className="size-3" />}
              {isTeamLead && <Users className="size-3" />}
              <span>{title}</span>
            </span>

            {isTeamLead && (
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-white/10 text-slate-300">
                Scope: {leadDomain}
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-display font-bold text-white">
            DSC Club Management Panel
          </h1>
          <span className="text-xs text-slate-400 font-mono">
            Signed in as: <strong className="text-slate-200">{currentUserEmail}</strong>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={signOut}
            className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Role-Aware Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3 mb-8">
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "dashboard"
              ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
              : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <LayoutDashboard className="size-3.5" />
          <span>Dashboard</span>
        </button>

        {/* Centralized Event Management (Super Admin, Faculty, Team Leads) */}
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "events"
              ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
              : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Calendar className="size-3.5" />
          <span>Event Management</span>
        </button>

        {/* Faculty Oversight (Faculty Coordinator only) */}
        {isFaculty && (
          <button
            type="button"
            onClick={() => setActiveTab("faculty_oversight")}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "faculty_oversight"
                ? "bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20"
                : "bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20"
            }`}
          >
            <GraduationCap className="size-3.5" />
            <span>Faculty Oversight</span>
          </button>
        )}

        {/* Registrations (Super Admin + Faculty) */}
        {(isSuperAdmin || isFaculty) && (
          <button
            type="button"
            onClick={() => setActiveTab("registrations")}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "registrations"
                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Ticket className="size-3.5" />
            <span>Registrations</span>
          </button>
        )}

        {/* Recruitment (Super Admin, Faculty, and Team Leads) */}
        <button
          type="button"
          onClick={() => setActiveTab("recruitment")}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "recruitment"
              ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
              : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Briefcase className="size-3.5" />
          <span>Recruitment {isTeamLead ? `(${leadDomain})` : "Candidates"}</span>
        </button>

        {/* Finance & Accounts (Super Admin + Faculty) */}
        {(isSuperAdmin || isFaculty) && (
          <button
            type="button"
            onClick={() => setActiveTab("finance")}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "finance"
                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Wallet className="size-3.5" />
            <span>Finance & Accounts</span>
          </button>
        )}

        {/* Team Leads Governance (Super Admin only) */}
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("team_leads")}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "team_leads"
                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Users className="size-3.5" />
            <span>Team Leads (RBAC)</span>
          </button>
        )}

        {/* Audit Logs (Super Admin + Faculty) */}
        {(isSuperAdmin || isFaculty) && (
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <History className="size-3.5" />
            <span>Audit Trail</span>
          </button>
        )}

        {/* Settings & Disaster Recovery (Super Admin only) */}
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "settings"
                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Settings className="size-3.5" />
            <span>Settings & Backup</span>
          </button>
        )}
      </div>

      {/* Tab Content Display */}
      <div className="animate-fadeIn">
        {activeTab === "dashboard" && (
          <AdminDashboardOverview
            userRole={role}
            leadDomain={leadDomain}
            onNavigateTab={(t) => setActiveTab(t)}
          />
        )}

        {activeTab === "events" && (
          <EventsAdminView
            userRole={role}
            leadDomain={leadDomain}
            actorEmail={currentUserEmail}
            actorUid={user?.uid || "admin-uid"}
            actorName={user?.displayName || title}
          />
        )}

        {activeTab === "faculty_oversight" && isFaculty && (
          <FacultyOversightView
            actorEmail={currentUserEmail}
            onNavigateTab={(t) => setActiveTab(t)}
          />
        )}

        {activeTab === "registrations" && (isSuperAdmin || isFaculty) && (
          <RegistrationsAdminView
            userRole={role}
            actorEmail={currentUserEmail}
          />
        )}

        {activeTab === "recruitment" && (
          <HiringAdminView
            userRole={role}
            leadDomain={leadDomain}
            actorEmail={currentUserEmail}
          />
        )}

        {activeTab === "finance" && (isSuperAdmin || isFaculty) && (
          <FinanceSectionView
            userRole={role}
            actorEmail={currentUserEmail}
          />
        )}

        {activeTab === "team_leads" && isSuperAdmin && (
          <TeamLeadManager actorEmail={currentUserEmail} />
        )}

        {activeTab === "logs" && (isSuperAdmin || isFaculty) && (
          <ActivityLogView />
        )}

        {activeTab === "settings" && isSuperAdmin && (
          <DatabaseBackupView actorEmail={currentUserEmail} />
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
