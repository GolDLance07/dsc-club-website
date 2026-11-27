import React, { useState, useRef } from "react";
import type { EventPosterItem } from "@/types/models";
import {
  uploadEventPoster,
  deleteEventPoster,
  validatePosterFile,
} from "@/lib/storage/r2-adapter";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface PosterUploadManagerProps {
  eventId: string;
  posters: EventPosterItem[];
  onChange: (updatedPosters: EventPosterItem[]) => void;
  disabled?: boolean;
}

interface UploadProgressState {
  id: string;
  name: string;
  progress: number;
  error?: string | undefined;
  file?: File | undefined;
}

export const PosterUploadManager: React.FC<PosterUploadManagerProps> = ({
  eventId,
  posters,
  onChange,
  disabled = false,
}) => {
  const [activeUploads, setActiveUploads] = useState<UploadProgressState[]>([]);
  const [validationError, setValidationError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUploadMore = posters.length + activeUploads.length < 5;

  // Handles file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError("");
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = 5 - (posters.length + activeUploads.length);
    if (files.length > availableSlots) {
      setValidationError(
        `You can only add ${availableSlots} more poster(s). Maximum 5 posters allowed per event.`
      );
    }

    const filesToUpload = Array.from(files).slice(0, availableSlots);

    for (const file of filesToUpload) {
      const validation = validatePosterFile(file);
      if (!validation.valid) {
        setValidationError(validation.error || "Invalid image file.");
        continue;
      }
      await startUpload(file);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload runner
  const startUpload = async (file: File) => {
    const tempId = `poster-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const uploadItem: UploadProgressState = {
      id: tempId,
      name: file.name,
      progress: 0,
      file,
    };

    setActiveUploads((prev) => [...prev, uploadItem]);

    try {
      const result = await uploadEventPoster(
        eventId || "draft-temp",
        file,
        tempId,
        (pct) => {
          setActiveUploads((prev) =>
            prev.map((item) =>
              item.id === tempId ? { ...item, progress: pct } : item
            )
          );
        }
      );

      // If this is the very first poster, designate it as primary cover automatically
      const isFirst = posters.length === 0;

      const newPoster: EventPosterItem = {
        id: tempId,
        url: result.url,
        storagePath: result.storagePath,
        caption: file.name.replace(/\.[^/.]+$/, ""),
        isPrimary: isFirst,
        displayOrder: posters.length + 1,
        width: result.width,
        height: result.height,
        uploadedAt: new Date().toISOString(),
      };

      onChange([...posters, newPoster]);
      setActiveUploads((prev) => prev.filter((item) => item.id !== tempId));
    } catch (err: unknown) {
      console.error("[DSC PosterUpload] Error uploading:", err);
      const msg = err instanceof Error ? err.message : "Upload failed. Click to retry.";
      setActiveUploads((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? { ...item, error: msg }
            : item
        )
      );
    }
  };

  // Retry failed upload
  const handleRetry = async (uploadItem: UploadProgressState) => {
    if (!uploadItem.file) return;
    setActiveUploads((prev) =>
      prev.map((item) =>
        item.id === uploadItem.id ? { ...item, error: undefined, progress: 0 } : item
      )
    );
    await startUpload(uploadItem.file);
  };

  // Remove active upload
  const handleCancelUpload = (tempId: string) => {
    setActiveUploads((prev) => prev.filter((item) => item.id !== tempId));
  };

  // Set primary poster
  const handleSetPrimary = (posterId: string) => {
    if (disabled) return;
    const updated = posters.map((p) => ({
      ...p,
      isPrimary: p.id === posterId,
    }));
    onChange(updated);
  };

  // Remove existing poster
  const handleDeletePoster = async (poster: EventPosterItem) => {
    if (disabled) return;
    try {
      await deleteEventPoster(poster.storagePath);
    } catch (err) {
      console.warn("Could not delete from storage immediately:", err);
    }

    const remaining = posters.filter((p) => p.id !== poster.id);

    // If we removed the primary poster and there are remaining posters, set the first one as primary
    if (poster.isPrimary && remaining.length > 0 && remaining[0]) {
      remaining[0].isPrimary = true;
    }

    // Re-index display orders
    const reordered = remaining.map((p, idx) => ({
      ...p,
      displayOrder: idx + 1,
    }));

    onChange(reordered);
  };

  // Reorder up
  const handleMoveUp = (index: number) => {
    if (disabled || index === 0) return;
    const items = [...posters];
    const prevItem = items[index - 1];
    const curItem = items[index];
    if (prevItem && curItem) {
      items[index - 1] = curItem;
      items[index] = prevItem;
      onChange(items.map((p, idx) => ({ ...p, displayOrder: idx + 1 })));
    }
  };

  // Reorder down
  const handleMoveDown = (index: number) => {
    if (disabled || index === posters.length - 1) return;
    const items = [...posters];
    const nextItem = items[index + 1];
    const curItem = items[index];
    if (nextItem && curItem) {
      items[index + 1] = curItem;
      items[index] = nextItem;
      onChange(items.map((p, idx) => ({ ...p, displayOrder: idx + 1 })));
    }
  };

  // Update caption
  const handleCaptionChange = (posterId: string, caption: string) => {
    if (disabled) return;
    const updated = posters.map((p) => (p.id === posterId ? { ...p, caption } : p));
    onChange(updated);
  };

  const hasPrimary = posters.some((p) => p.isPrimary);

  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div>
          <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
            <ImageIcon className="size-3.5" /> Event Posters & Media Assets
          </h4>
          <p className="text-[11px] text-slate-400">
            Upload 1 to 5 posters (JPEG, PNG, WebP &le; 5 MB). Exactly 1 primary cover poster required for publication.
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-300">
          Slots: <strong className="text-white">{posters.length} / 5</strong>
        </span>
      </div>

      {validationError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-rose-400" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Primary indicator warning */}
      {posters.length > 0 && !hasPrimary && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-amber-400" />
          <span>No primary cover poster selected. Click the star on one poster to set it as cover.</span>
        </div>
      )}

      {/* Upload Zone */}
      {canUploadMore && !disabled && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/20 hover:border-cyan-400/60 rounded-2xl p-6 text-center transition-all cursor-pointer bg-slate-950/40 hover:bg-cyan-500/5 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="size-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="size-5" />
            </div>
            <div className="text-xs font-semibold text-white">
              Click or drag images to upload
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              WebP, PNG, or JPEG &bull; Up to 5 MB per poster &bull; {5 - (posters.length + activeUploads.length)} slots left
            </div>
          </div>
        </div>
      )}

      {/* Active Uploads with Progress */}
      {activeUploads.length > 0 && (
        <div className="space-y-2">
          {activeUploads.map((up) => (
            <div
              key={up.id}
              className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs"
            >
              <div className="flex-1 mr-4">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-white font-mono truncate max-w-[200px]">
                    {up.name}
                  </span>
                  {up.error ? (
                    <span className="text-rose-400 font-bold">{up.error}</span>
                  ) : (
                    <span className="text-cyan-400 font-mono">{up.progress}%</span>
                  )}
                </div>
                {!up.error ? (
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-cyan-400 h-full transition-all duration-200"
                      style={{ width: `${up.progress}%` }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {up.error ? (
                  <button
                    type="button"
                    onClick={() => handleRetry(up)}
                    className="p-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                    title="Retry Upload"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                ) : (
                  <RefreshCw className="size-3.5 text-cyan-400 animate-spin" />
                )}
                <button
                  type="button"
                  onClick={() => handleCancelUpload(up.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400"
                  title="Cancel"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Poster Grid */}
      {posters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {posters.map((poster, index) => (
            <div
              key={poster.id}
              className={`p-3 rounded-2xl bg-slate-900 border transition-all relative flex flex-col justify-between ${
                poster.isPrimary
                  ? "border-amber-400/60 shadow-lg shadow-amber-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {/* Primary Badge */}
              {poster.isPrimary && (
                <div className="absolute top-4 left-4 z-10 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow">
                  <Star className="size-2.5 fill-slate-950" />
                  Primary Cover
                </div>
              )}

              {/* Image Preview Container */}
              <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/5 relative group mb-2.5">
                <img
                  src={poster.url}
                  alt={poster.caption || "Event Poster"}
                  className="w-full h-full object-cover"
                />

                {/* Hover overlay controls */}
                {!disabled && (
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!poster.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(poster.id)}
                        className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold flex items-center gap-1"
                        title="Set as Primary Cover Poster"
                      >
                        <Star className="size-3" /> Cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeletePoster(poster)}
                      className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                      title="Remove Poster"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Caption & Reordering Footer */}
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Poster label (e.g. Schedule, Speakers)"
                  value={poster.caption || ""}
                  onChange={(e) => handleCaptionChange(poster.id, e.target.value)}
                  disabled={disabled}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:border-cyan-400 focus:outline-none"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono">Order: #{poster.displayOrder}</span>
                  {!disabled && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveUp(index)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300"
                        title="Move Up"
                      >
                        <ArrowUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        disabled={index === posters.length - 1}
                        onClick={() => handleMoveDown(index)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300"
                        title="Move Down"
                      >
                        <ArrowDown className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
