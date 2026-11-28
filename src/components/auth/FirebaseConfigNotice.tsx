import React from "react";
import { AlertTriangle, KeyRound, ExternalLink, Terminal } from "lucide-react";

export const FirebaseConfigNotice: React.FC = () => {
  return (
    <div className="admin-page-container flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl p-8 rounded-3xl bg-slate-900/90 border border-amber-500/30 shadow-2xl backdrop-blur-xl relative text-left">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
          <AlertTriangle className="size-6" />
        </div>

        <h2 className="text-2xl font-display font-bold text-white mb-2">
          Firebase Configuration Required
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed mb-6">
          The Management Panel has migrated to authoritative Firebase Authentication and Firestore RBAC.
          To sign in, please configure your client credentials in your local <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-cyan-300">.env</code> file.
        </p>

        <div className="p-4 rounded-xl bg-slate-950 border border-white/10 mb-6">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
            <KeyRound className="size-3 text-cyan-400" /> Required Client Environment Variables
          </span>
          <pre className="font-mono text-[11px] text-slate-300 space-y-1 overflow-x-auto leading-relaxed">
            <div><span className="text-cyan-400">VITE_FIREBASE_API_KEY</span>="AIzaSy..."</div>
            <div><span className="text-cyan-400">VITE_FIREBASE_AUTH_DOMAIN</span>="dscvitb-ac7bf.firebaseapp.com"</div>
            <div><span className="text-cyan-400">VITE_FIREBASE_PROJECT_ID</span>="dscvitb-ac7bf"</div>
            <div><span className="text-cyan-400">VITE_FIREBASE_MESSAGING_SENDER_ID</span>="123456789"</div>
            <div><span className="text-cyan-400">VITE_FIREBASE_APP_ID</span>="1:123456789:web:abcdef"</div>
            <div><span className="text-cyan-400">VITE_WORKER_API_URL</span>="https://dsc-event-lifecycle-worker.&lt;subdomain&gt;.workers.dev"</div>
          </pre>
        </div>

        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200 mb-6 leading-relaxed flex items-start gap-3">
          <Terminal className="size-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong>Next Step:</strong> Copy <code className="font-mono text-white">.env.example</code> to <code className="font-mono text-white">.env</code>, paste your Firebase project credentials, and restart the Vite development server.
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Public website routes (<a href="/" className="text-cyan-400 hover:underline">Home</a>, <a href="/events" className="text-cyan-400 hover:underline">Events</a>, <a href="/members" className="text-cyan-400 hover:underline">Members</a>) remain fully functional in offline/static mode.
        </div>
      </div>
    </div>
  );
};
