import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { CentralizedClubEvent, EventStatus, EventTag, LeadDomain, RoleType } from "@/types/models";
import {
  getEventsForAdmin,
  createEventDraft,
  updateEventDraft,
  publishEvent,
  unpublishEvent,
  archiveEvent,
  deleteEvent,
  validatePublishEvent,
} from "@/lib/firebase/events";
import { PosterUploadManager } from "./PosterUploadManager";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Search,
  Filter,
  Plus,
  Edit3,
  Globe,
  Archive,
  EyeOff,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Star,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface EventsAdminViewProps {
  userRole: RoleType;
  leadDomain: LeadDomain;
  actorEmail: string;
  actorUid?: string;
  actorName?: string;
}

const CATEGORIES: EventTag[] = [
  "HACKATHON",
  "BOOTCAMP",
  "WORKSHOP",
  "TECH TALK",
  "MEETUP",
];

const DOMAINS: LeadDomain[] = [
  "Technical",
  "AI & Data Science",
  "Design & Media",
  "Content & Editorial",
  "Management & PR",
];

export const EventsAdminView: React.FC<EventsAdminViewProps> = ({
  userRole,
  leadDomain,
  actorEmail,
  actorUid = "admin-uid",
  actorName = "Admin",
}) => {
  const [events, setEvents] = useState<CentralizedClubEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [domainFilter, setDomainFilter] = useState<string>(
    userRole === "team_lead" && leadDomain !== "None" ? leadDomain : "All"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CentralizedClubEvent | null>(null);
  const [actionError, setActionError] = useState<string>("");
  const [actionSuccess, setActionSuccess] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [operatingEventId, setOperatingEventId] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>("");
  const [formSlug, setFormSlug] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("WORKSHOP");
  const [formDomain, setFormDomain] = useState<LeadDomain>(
    userRole === "team_lead" && leadDomain !== "None" ? leadDomain : "Technical"
  );
  const [formVenue, setFormVenue] = useState<string>("");
  const [formTimeDisplay, setFormTimeDisplay] = useState<string>("");
  const [formStartDate, setFormStartDate] = useState<string>("");
  const [formEndDate, setFormEndDate] = useState<string>("");
  const [formDeadline, setFormDeadline] = useState<string>("");
  const [formMaxCapacity, setFormMaxCapacity] = useState<number>(100);
  const [formDescription, setFormDescription] = useState<string>("");
  const [formLongBio, setFormLongBio] = useState<string>("");
  const [formPosters, setFormPosters] = useState<CentralizedClubEvent["posters"]>([]);

  const isSuperAdmin = userRole === "super_admin";
  const isFaculty = userRole === "faculty_coordinator";
  const isTeamLead = userRole === "team_lead";

  // Load events
  const fetchEvents = useCallback(async () => {
    try {
      const data = await getEventsForAdmin(userRole, leadDomain);
      setEvents(data);
    } catch (err: unknown) {
      console.error("[DSC EventsAdminView] Error loading events:", err);
      const msg = err instanceof Error ? err.message : "Failed to load events.";
      setActionError(msg);
    } finally {
      setLoading(false);
    }
  }, [userRole, leadDomain]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setActionError("");
    setActionSuccess("");
    setEditingEvent(null);
    setFormTitle("");
    setFormSlug("");
    setFormCategory("WORKSHOP");
    setFormDomain(userRole === "team_lead" && leadDomain !== "None" ? leadDomain : "Technical");
    setFormVenue("");
    setFormTimeDisplay("");

    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const deadline = new Date(future.getTime() - 24 * 60 * 60 * 1000);

    setFormStartDate(future.toISOString().slice(0, 16));
    setFormEndDate(new Date(future.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setFormDeadline(deadline.toISOString().slice(0, 16));
    setFormMaxCapacity(150);
    setFormDescription("");
    setFormLongBio("");
    setFormPosters([]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (event: CentralizedClubEvent) => {
    setActionError("");
    setActionSuccess("");
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormSlug(event.slug);
    setFormCategory(event.category);
    setFormDomain(event.domainScope);
    setFormVenue(event.venue);
    setFormTimeDisplay(event.timeDisplay);
    setFormStartDate(event.startDate ? event.startDate.slice(0, 16) : "");
    setFormEndDate(event.endDate ? event.endDate.slice(0, 16) : "");
    setFormDeadline(event.registrationDeadline ? event.registrationDeadline.slice(0, 16) : "");
    setFormMaxCapacity(event.maxCapacity || 100);
    setFormDescription(event.description || "");
    setFormLongBio(event.longBio || "");
    setFormPosters(event.posters || []);
    setIsModalOpen(true);
  };

  // Auto-generate slug from title
  const handleTitleChange = (val: string) => {
    setFormTitle(val);
    if (!editingEvent) {
      setFormSlug(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"));
    }
  };

  // Save Event Draft
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    setSaving(true);

    if (!formTitle.trim()) {
      setActionError("Event title is required.");
      setSaving(false);
      return;
    }

    const payload = {
      title: formTitle.trim(),
      slug: formSlug.trim() || formTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-"),
      category: formCategory,
      domainScope: isTeamLead ? leadDomain : formDomain,
      venue: formVenue.trim(),
      timeDisplay: formTimeDisplay.trim(),
      startDate: new Date(formStartDate).toISOString(),
      endDate: new Date(formEndDate).toISOString(),
      registrationDeadline: new Date(formDeadline).toISOString(),
      maxCapacity: Number(formMaxCapacity) || 100,
      description: formDescription.trim(),
      longBio: formLongBio.trim(),
      posters: formPosters,
      isRegistrationOpen: true,
    };

    try {
      if (editingEvent) {
        await updateEventDraft(editingEvent.id, payload, userRole, leadDomain);
        setActionSuccess(`Successfully updated draft for "${payload.title}".`);
      } else {
        await createEventDraft(
          payload,
          { uid: actorUid, email: actorEmail, name: actorName },
          userRole,
          leadDomain
        );
        setActionSuccess(`Successfully created draft for "${payload.title}".`);
      }

      await fetchEvents();
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to save event draft.");
    } finally {
      setSaving(false);
    }
  };

  // Publish Event (Super Admin Only via Trusted Backend)
  const handlePublish = async (eventId: string, eventTitle: string) => {
    if (!isSuperAdmin) {
      setActionError("Only Super Admin can publish events.");
      return;
    }
    if (!confirm(`Are you sure you want to publish "${eventTitle}"? It will appear immediately on the public website.`)) {
      return;
    }

    setOperatingEventId(eventId);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await publishEvent(eventId, userRole);
      setActionSuccess(res.message || `Event "${eventTitle}" is now LIVE on the public website.`);
      await fetchEvents();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to publish event.");
    } finally {
      setOperatingEventId(null);
    }
  };

  // Unpublish Event (Super Admin Only via Trusted Backend)
  const handleUnpublish = async (eventId: string, eventTitle: string) => {
    if (!isSuperAdmin) return;
    if (!confirm(`Unpublish "${eventTitle}"? It will be hidden from the public website and reverted to draft status.`)) {
      return;
    }

    setOperatingEventId(eventId);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await unpublishEvent(eventId, userRole);
      setActionSuccess(res.message || `"${eventTitle}" has been unpublished back to draft.`);
      await fetchEvents();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to unpublish event.");
    } finally {
      setOperatingEventId(null);
    }
  };

  // Archive Event (Super Admin Only via Trusted Backend)
  const handleArchive = async (eventId: string, eventTitle: string) => {
    if (!isSuperAdmin) return;
    if (!confirm(`Archive "${eventTitle}"? It will be moved to the completed event archive.`)) {
      return;
    }

    setOperatingEventId(eventId);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await archiveEvent(eventId, userRole);
      setActionSuccess(res.message || `"${eventTitle}" has been archived.`);
      await fetchEvents();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || "Failed to archive event.");
    } finally {
      setOperatingEventId(null);
    }
  };

  // Delete Event (Super Admin Only)
  const handleDelete = async (eventId: string, eventTitle: string) => {
    if (!isSuperAdmin) return;
    if (!confirm(`PERMANENT ACTION: Delete event "${eventTitle}" and all attached posters?`)) {
      return;
    }

    try {
      await deleteEvent(eventId, userRole);
      setActionSuccess(`Event "${eventTitle}" deleted.`);
      await fetchEvents();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || "Failed to delete event.");
    }
  };

  // Filtered Events List
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || e.status === statusFilter.toLowerCase();

      const matchesDomain =
        domainFilter === "All" || e.domainScope === domainFilter;

      return matchesSearch && matchesStatus && matchesDomain;
    });
  }, [events, searchQuery, statusFilter, domainFilter]);

  return (
    <div className="space-y-6 text-left">
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Calendar className="size-5 text-cyan-400" />
            Centralized Event Management
          </h3>
          <p className="text-xs text-slate-400">
            Create drafts, upload high-res posters, manage capacities, and control publishing.
          </p>
        </div>

        {/* Create Button (Super Admin & Team Lead) */}
        {(isSuperAdmin || isTeamLead) && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer self-start md:self-auto"
          >
            <Plus className="size-4" />
            <span>Create Event Draft</span>
          </button>
        )}
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search events by title, venue, category, or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 text-white rounded-xl pl-9 pr-4 py-2 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 border border-white/10 rounded-xl p-1">
            {["All", "Draft", "Published", "Archived"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all ${
                  statusFilter === st
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Domain Filter (Super Admin & Faculty only) */}
          {(isSuperAdmin || isFaculty) && (
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="bg-slate-950 border border-white/10 text-slate-300 rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none font-mono"
            >
              <option value="All">All Domains</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={fetchEvents}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
            title="Refresh events list"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Events Table / Card Grid */}
      {loading ? (
        <div className="flex min-h-[250px] items-center justify-center">
          <div className="flex items-center gap-3 text-cyan-400 font-mono text-xs">
            <RefreshCw className="size-4 animate-spin" />
            <span>Loading Events Directory...</span>
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-white/10 text-slate-400 text-xs">
          <Calendar className="size-8 mx-auto text-slate-500 mb-2" />
          <p className="font-semibold text-white mb-1">No events found matching your filter.</p>
          <p className="text-[11px]">
            {isTeamLead
              ? `You are scoped to "${leadDomain}". Click "Create Event Draft" to begin drafting.`
              : "Try adjusting your search criteria or create a new event draft."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            const primaryPoster =
              event.posters?.find((p) => p.isPrimary) || event.posters?.[0];
            const validation = validatePublishEvent(event);
            const canEdit =
              isSuperAdmin || (isTeamLead && event.domainScope === leadDomain && event.status === "draft");

            return (
              <div
                key={event.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Poster Thumbnail Header */}
                  <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-950 border border-white/5 mb-3 relative">
                    {primaryPoster ? (
                      <img
                        src={primaryPoster.url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-xs">
                        <Calendar className="size-6 mb-1 opacity-50" />
                        <span>No Poster Uploaded</span>
                      </div>
                    )}

                    {/* Status Pill */}
                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider ${
                          event.status === "published"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 backdrop-blur-md"
                            : event.status === "draft"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md"
                            : "bg-slate-500/20 text-slate-300 border border-slate-500/40 backdrop-blur-md"
                        }`}
                      >
                        {event.status}
                      </span>
                    </div>

                    {/* Category & Domain badge */}
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[9px] font-mono text-cyan-300 border border-white/10">
                        {event.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[9px] font-mono text-slate-300 border border-white/10">
                        {event.domainScope}
                      </span>
                    </div>
                  </div>

                  {/* Title & Timing */}
                  <h4 className="text-sm font-bold text-white mb-1 line-clamp-1">
                    {event.title}
                  </h4>
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {event.description}
                  </p>

                  <div className="space-y-1.5 text-[11px] text-slate-300 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3 text-cyan-400 shrink-0" />
                      <span className="truncate">{event.timeDisplay || "Time TBA"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3 text-cyan-400 shrink-0" />
                      <span className="truncate">{event.venue || "Venue TBA"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3 text-cyan-400 shrink-0" />
                      <span>
                        Capacity: <strong>{event.currentRegistrations || 0}</strong> / {event.maxCapacity} attendees
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] font-mono text-slate-400">
                    {event.posters?.length || 0} poster(s)
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Edit Draft */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(event)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="size-3" />
                        <span>Edit</span>
                      </button>
                    )}

                    {/* Read-only view for Faculty */}
                    {isFaculty && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(event)}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        View Details
                      </button>
                    )}

                    {/* Publish (Super Admin Only via Trusted Backend) */}
                    {isSuperAdmin && event.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => handlePublish(event.id, event.title)}
                        disabled={!validation.valid || operatingEventId === event.id}
                        title={
                          validation.valid
                            ? "Publish to live website"
                            : `Cannot Publish:\n- ${validation.errors.join("\n- ")}`
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {operatingEventId === event.id ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            <span>Publishing...</span>
                          </>
                        ) : (
                          <>
                            <Globe className="size-3" />
                            <span>Publish</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Unpublish (Super Admin Only via Trusted Backend) */}
                    {isSuperAdmin && event.status === "published" && (
                      <button
                        type="button"
                        onClick={() => handleUnpublish(event.id, event.title)}
                        disabled={operatingEventId === event.id}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Unpublish event back to draft"
                      >
                        {operatingEventId === event.id ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            <span>Unpublishing...</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="size-3" />
                            <span>Unpublish</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Archive (Super Admin Only via Trusted Backend) */}
                    {isSuperAdmin && event.status === "published" && (
                      <button
                        type="button"
                        onClick={() => handleArchive(event.id, event.title)}
                        disabled={operatingEventId === event.id}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Archive completed event"
                      >
                        {operatingEventId === event.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Archive className="size-3" />
                        )}
                      </button>
                    )}

                    {/* Delete (Super Admin Only) */}
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(event.id, event.title)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors"
                        title="Delete event record"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8 p-6 md:p-8 rounded-3xl bg-slate-900 border border-white/15 shadow-2xl relative text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                  <Calendar className="size-4 text-cyan-400" />
                  {isFaculty
                    ? `Audit Event: ${editingEvent?.title}`
                    : editingEvent
                    ? `Edit Event: ${editingEvent.title}`
                    : "Create New Event Draft"}
                </h3>
                <p className="text-xs text-slate-400">
                  {isFaculty
                    ? "Read-only inspection for institutional oversight."
                    : "Fill out the required event metadata and attach 1–5 posters."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {actionError && (
              <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-rose-400" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDraft} className="space-y-6 text-xs">
              {/* Row 1: Title & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isFaculty}
                    placeholder="e.g. PyTorch Deep Learning Sprint"
                    value={formTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3.5 py-2.5 text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Slug (URL Key) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isFaculty || Boolean(editingEvent)}
                    placeholder="pytorch-bootcamp-2026"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono focus:border-cyan-400 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Row 2: Category, Domain, Venue */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Category *
                  </label>
                  <select
                    disabled={isFaculty}
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3 py-2.5 text-xs focus:border-cyan-400 focus:outline-none font-mono"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Domain Scope *
                  </label>
                  <select
                    disabled={isFaculty || isTeamLead}
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value as LeadDomain)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3 py-2.5 text-xs focus:border-cyan-400 focus:outline-none font-mono disabled:opacity-50"
                  >
                    {DOMAINS.map((dom) => (
                      <option key={dom} value={dom}>
                        {dom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Max Capacity Ceiling *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    disabled={isFaculty}
                    value={formMaxCapacity}
                    onChange={(e) => setFormMaxCapacity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3.5 py-2.5 text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 3: Dates & Timings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    disabled={isFaculty}
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    disabled={isFaculty}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Registration Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    disabled={isFaculty}
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3 py-2 text-xs focus:border-cyan-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Row 4: Venue & Display Time String */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Venue / Location *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isFaculty}
                    placeholder="e.g. Lab Complex 3 // AB-1 High-Perf Lab"
                    value={formVenue}
                    onChange={(e) => setFormVenue(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3.5 py-2.5 text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Time Display Label *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isFaculty}
                    placeholder="e.g. 10:00 AM - 4:00 PM IST"
                    value={formTimeDisplay}
                    onChange={(e) => setFormTimeDisplay(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl px-3.5 py-2.5 text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 5: Descriptions */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Short Overview Summary (min 20 chars) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    disabled={isFaculty}
                    placeholder="Brief 2-3 sentence overview displayed on event cards."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl p-3 text-xs focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-300 block mb-1">
                    Detailed Briefing & Schedule Bio (min 50 chars) *
                  </label>
                  <textarea
                    rows={4}
                    required
                    disabled={isFaculty}
                    placeholder="Comprehensive description displayed in the event details modal."
                    value={formLongBio}
                    onChange={(e) => setFormLongBio(e.target.value)}
                    className="w-full bg-slate-950 border border-white/20 text-white rounded-xl p-3 text-xs focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Row 6: Poster Upload Section */}
              <div className="pt-2">
                <PosterUploadManager
                  eventId={formSlug || editingEvent?.id || "temp-event"}
                  posters={formPosters}
                  onChange={(updated) => setFormPosters(updated)}
                  disabled={isFaculty}
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Close
                </button>

                {!isFaculty && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {saving && <RefreshCw className="size-3.5 animate-spin" />}
                    <span>{editingEvent ? "Save Event Changes" : "Save as Draft"}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
