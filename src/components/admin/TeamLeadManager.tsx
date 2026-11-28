import React, { useState, useEffect, useCallback } from "react";
import { assignPanelRole, getPanelUserRoles } from "@/lib/firebase/roles";
import { isWorkerConfigured } from "@/lib/firebase/events";
import type { UserRoleRecord, LeadDomain, RoleType } from "@/types/models";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Crown,
  GraduationCap,
  Users,
  RefreshCw,
} from "lucide-react";

interface TeamLeadManagerProps {
  actorEmail?: string;
}

const DOMAINS: LeadDomain[] = [
  "Technical",
  "AI & Data Science",
  "Design & Media",
  "Content & Editorial",
  "Management & PR",
];

export const TeamLeadManager: React.FC<TeamLeadManagerProps> = ({
  actorEmail = "president@dsc.vitbhopal.ac.in",
}) => {
  const [roles, setRoles] = useState<UserRoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<RoleType>("team_lead");
  const [newTitle, setNewTitle] = useState("Technical Team Lead");
  const [newDomain, setNewDomain] = useState<LeadDomain>("Technical");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchRoles = useCallback(async () => {
    try {
      const list = await getPanelUserRoles();
      setRoles(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load panel role records.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedName = newName.trim();

    if (!trimmedEmail || !trimmedName) {
      setErrorMessage("Please enter both full name and valid university email.");
      return;
    }

    if (trimmedEmail === actorEmail.trim().toLowerCase()) {
      setErrorMessage("Permission Denied: You cannot modify your own role.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await assignPanelRole({
        email: trimmedEmail,
        fullName: trimmedName,
        role: newRole,
        title: newTitle.trim(),
        leadDomain: newRole === "team_lead" ? newDomain : "None",
      });

      setSuccessMessage(
        res.message ||
          `Granted ${res.role} role to ${res.email}. They must sign out and sign back in to refresh their Firebase session.`
      );
      setNewEmail("");
      setNewName("");
      await fetchRoles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to assign role.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRole = async (email: string) => {
    if (email.toLowerCase() === actorEmail.trim().toLowerCase()) {
      setErrorMessage("Permission Denied: You cannot revoke your own Super Admin access.");
      return;
    }

    if (confirm(`Revoke management panel privileges for ${email} (demote to member)?`)) {
      setErrorMessage("");
      setSuccessMessage("");
      try {
        const res = await assignPanelRole({
          email,
          role: "member",
          leadDomain: "None",
          title: "Club Member",
        });
        setSuccessMessage(res.message || `Revoked panel access for ${email}.`);
        await fetchRoles();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to revoke role.";
        setErrorMessage(msg);
      }
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Overview notice */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
        <ShieldCheck className="size-5 text-cyan-400 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-white mb-1">
            Role-Based Access Control (RBAC) Governance
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            Only authorized email addresses can sign into the management panel. Team Leads only
            receive scoped visibility into their designated domain and have zero access to the
            Finance ledger.
          </p>
        </div>
      </div>

      {/* Add Role Form */}
      <form onSubmit={handleAddLead} className="p-6 rounded-2xl bg-slate-900/80 border border-white/10">
        <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-4 flex items-center gap-2">
          <UserPlus className="size-4" /> Provision New Panel Role / Team Lead
        </h4>

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="size-4" /> {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="size-4" /> {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-4">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Rohan Gupta"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-950 border border-white/15 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">University Email Address *</label>
            <input
              type="email"
              placeholder="e.g. rohan.lead@vitbhopal.ac.in"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-slate-950 border border-white/15 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Access Role Level *</label>
            <select
              value={newRole}
              onChange={(e) => {
                const r = e.target.value as RoleType;
                setNewRole(r);
                if (r === "faculty_coordinator") setNewTitle("Faculty Coordinator");
                if (r === "super_admin") setNewTitle("General Secretary");
                if (r === "team_lead") setNewTitle("Technical Team Lead");
              }}
              className="w-full bg-slate-950 border border-white/15 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none"
            >
              <option value="team_lead">Team Lead (Domain-Scoped)</option>
              <option value="super_admin">Super Admin (President, VP, GS, JS)</option>
              <option value="faculty_coordinator">Faculty Coordinator (Read-Only Oversight)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Designation Title *</label>
            <input
              type="text"
              placeholder="e.g. Design Team Lead"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-slate-950 border border-white/15 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none"
              required
            />
          </div>

          {newRole === "team_lead" && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Assigned Domain Scope *</label>
              <select
                value={newDomain}
                onChange={(e) => {
                  const d = e.target.value as LeadDomain;
                  setNewDomain(d);
                  setNewTitle(`${d} Team Lead`);
                }}
                className="w-full bg-slate-950 border border-white/15 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none"
              >
                {DOMAINS.map((dom) => (
                  <option key={dom} value={dom}>
                    {dom}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting || !isWorkerConfigured()}
              className="w-full px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting && <RefreshCw className="size-3.5 animate-spin" />}
              <span>{submitting ? "Granting Access..." : "+ Grant Access"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Roles List */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden">
        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            Active Management Panel Accounts ({roles.length})
          </span>
        </div>

        <div className="divide-y divide-white/5 text-xs">
          {loading ? (
            <div className="p-6 text-center text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
              <RefreshCw className="size-3.5 animate-spin text-cyan-400" />
              <span>Loading authorized accounts...</span>
            </div>
          ) : roles.length === 0 ? (
            <div className="p-6 text-center text-slate-400 font-mono text-xs">
              No active panel role records found in Firestore yet.
            </div>
          ) : (
            roles.map((r) => (
              <div
                key={r.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-cyan-400">
                    {r.role === "super_admin" ? (
                      <Crown className="size-4 text-amber-400" />
                    ) : r.role === "faculty_coordinator" ? (
                      <GraduationCap className="size-4 text-purple-400" />
                    ) : (
                      <Users className="size-4 text-cyan-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">{r.fullName}</div>
                    <div className="text-[11px] font-mono text-slate-400">{r.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-semibold text-slate-200 block text-xs">{r.title}</span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      {r.role === "team_lead" ? `Scope: ${r.leadDomain}` : r.role.toUpperCase()}
                    </span>
                  </div>

                  {r.email.toLowerCase() !== actorEmail.toLowerCase() &&
                    r.email.toLowerCase() !== "neelpandeyofficial@gmail.com" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(r.email)}
                        className="p-2 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
                        title="Revoke Access"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
