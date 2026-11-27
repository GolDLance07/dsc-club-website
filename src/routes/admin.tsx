import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/sections/Navbar";
import { AdminPanel } from "@/components/pages/AdminPanel";
import { FooterSection } from "@/components/sections/FooterSection";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — DSC Club VITB" },
      {
        name: "description",
        content: "Administrative recruitment portal for Data Science Club VIT Bhopal.",
      },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <div className="min-h-screen bg-[#0a192f] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      <Navbar />
      <main className="relative pt-24 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <AdminPanel />
      </main>
      <FooterSection />
    </div>
  );
}

export default AdminRoute;
