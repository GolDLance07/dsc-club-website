import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/sections/Navbar";
import { HiringPortal } from "@/components/hiring/HiringPortal";
import { FooterSection } from "@/components/sections/FooterSection";

export const Route = createFileRoute("/hiring")({
  head: () => ({
    meta: [
      { title: "Recruitment Portal — DSC Club VITB" },
      {
        name: "description",
        content:
          "Official Core Team Hiring & Recruitment Portal for the Data Science Club at VIT Bhopal.",
      },
      { property: "og:title", content: "Recruitment Portal — DSC Club VITB" },
      {
        property: "og:description",
        content: "Apply for open domain roles at DSC VIT Bhopal.",
      },
    ],
  }),
  component: HiringRoute,
});

function HiringRoute() {
  return (
    <div className="min-h-screen bg-transparent text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />
      <main className="relative pt-28 sm:pt-36 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <HiringPortal />
      </main>
      <FooterSection />
    </div>
  );
}

export default HiringRoute;
