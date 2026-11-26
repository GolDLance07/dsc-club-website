import React, { useState, useMemo } from "react";
import { Search, Users, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export interface TeamMember {
  name: string;
  role: string;
  group:
    | "Panel"
    | "HR Team"
    | "Event Management Team"
    | "PR & Outreach Team"
    | "Content Team"
    | "Technical Team"
    | "Social Media Team"
    | "Design Team"
    | "Photography Team"
    | "Software Dev Team";
}

const teamMembers: TeamMember[] = [
  // PANEL
  { name: "Divish Jain", role: "President", group: "Panel" },
  { name: "Kritika Maurya", role: "Vice President", group: "Panel" },
  { name: "Aman Panday", role: "General Secretary", group: "Panel" },
  { name: "Somya Tiwari", role: "Joint Secretary", group: "Panel" },
  { name: "Shriyash Sahu", role: "Ops Manager", group: "Panel" },

  // HR TEAM
  { name: "Aditya Saini", role: "Lead", group: "HR Team" },
  { name: "Vedant Patil", role: "Co-Lead", group: "HR Team" },
  { name: "Gargi Singh", role: "Core Member", group: "HR Team" },
  { name: "Swagatika Priyadarshini Sahoo", role: "Core Member", group: "HR Team" },
  { name: "Tanisha Sethi", role: "Core Member", group: "HR Team" },
  { name: "Mitali Pandey", role: "Core Member", group: "HR Team" },
  { name: "Aryan Awasthi", role: "Core Member", group: "HR Team" },
  { name: "Aryan Raj Mishra", role: "Core Member", group: "HR Team" },

  // EVENT MANAGEMENT TEAM
  { name: "Ayush Gupta", role: "Lead", group: "Event Management Team" },
  { name: "Arunika Bag", role: "Co-Lead", group: "Event Management Team" },
  { name: "Ashutosh Shrivastava", role: "Co-Lead", group: "Event Management Team" },
  { name: "Divyansh Dhimole", role: "Core Member", group: "Event Management Team" },
  { name: "Akshat Mujmer", role: "Core Member", group: "Event Management Team" },
  { name: "Anshima", role: "Core Member", group: "Event Management Team" },
  { name: "Nilesh Ugale", role: "Core Member", group: "Event Management Team" },
  { name: "Ayush Ranjan", role: "Core Member", group: "Event Management Team" },
  { name: "Prashant Dubey", role: "Core Member", group: "Event Management Team" },
  { name: "Rakshit Yadav", role: "Core Member", group: "Event Management Team" },
  { name: "Anushka Dubey", role: "Core Member", group: "Event Management Team" },
  { name: "Bhawesh Kumar Gautam", role: "Core Member", group: "Event Management Team" },
  { name: "Sandeep Ganesh", role: "Core Member", group: "Event Management Team" },
  { name: "Anvesha Agrawal", role: "Core Member", group: "Event Management Team" },
  { name: "Satwik Singh", role: "Core Member", group: "Event Management Team" },
  { name: "Anushka Sahu", role: "Core Member", group: "Event Management Team" },
  { name: "Khushi Thakur", role: "Core Member", group: "Event Management Team" },
  { name: "Krishna Nishad", role: "Core Member", group: "Event Management Team" },
  { name: "Tejal Sharma", role: "Core Member", group: "Event Management Team" },
  { name: "Abhinav Gomra", role: "Core Member", group: "Event Management Team" },
  { name: "Siddhi Gupta", role: "Core Member", group: "Event Management Team" },
  { name: "Salam Khan", role: "Core Member", group: "Event Management Team" },

  // PR AND OUTREACH TEAM
  { name: "Shalini Pal", role: "Lead", group: "PR & Outreach Team" },
  { name: "Soumya Chouhan", role: "Co-Lead", group: "PR & Outreach Team" },
  { name: "Sousthab Mitra", role: "Core Member", group: "PR & Outreach Team" },
  { name: "Pranjal Bhatnagar", role: "Core Member", group: "PR & Outreach Team" },
  { name: "Anandita Sharma", role: "Core Member", group: "PR & Outreach Team" },
  { name: "Karan Kumar Gupta", role: "Core Member", group: "PR & Outreach Team" },
  { name: "Sivi Shrivastav", role: "Core Member", group: "PR & Outreach Team" },
  { name: "Vijval Singh", role: "Core Member", group: "PR & Outreach Team" },

  // CONTENT TEAM
  { name: "Jihi Mamtani", role: "Lead", group: "Content Team" },
  { name: "Anusha Singh Rajput", role: "Co-Lead", group: "Content Team" },
  { name: "Shruti Mishra", role: "Core Member", group: "Content Team" },
  { name: "Akshat Singh", role: "Core Member", group: "Content Team" },
  { name: "Ananya Pandey", role: "Core Member", group: "Content Team" },
  { name: "Bhavesh Wadhwani", role: "Core Member", group: "Content Team" },
  { name: "Ashi Gupta", role: "Core Member", group: "Content Team" },

  // TECHNICAL TEAM
  { name: "Sumit Tripathi", role: "Lead", group: "Technical Team" },
  { name: "Abhishek Bochare", role: "Core Member", group: "Technical Team" },
  { name: "Sparsh Kapoor", role: "Core Member", group: "Technical Team" },
  { name: "Harshit Mohta", role: "Core Member", group: "Technical Team" },
  { name: "Divyanshi Adhikari", role: "Core Member", group: "Technical Team" },
  { name: "Monika Sahu", role: "Core Member", group: "Technical Team" },
  { name: "Parth Chopra", role: "Core Member", group: "Technical Team" },
  { name: "Anwesha Dhote", role: "Core Member", group: "Technical Team" },
  { name: "Mansi Kumari", role: "Core Member", group: "Technical Team" },
  { name: "Siddhi Dogne", role: "Core Member", group: "Technical Team" },
  { name: "Kuldeep", role: "Core Member", group: "Technical Team" },

  // SOCIAL MEDIA TEAM
  { name: "Himesh Jham", role: "Lead", group: "Social Media Team" },
  { name: "Shalvi Pandey", role: "Co-Lead", group: "Social Media Team" },
  { name: "Pari Pancholiya", role: "Co-Lead", group: "Social Media Team" },
  { name: "Ankit Kumar Yadav", role: "Core Member", group: "Social Media Team" },
  { name: "Rudra Pratap Singh", role: "Core Member", group: "Social Media Team" },
  { name: "Sanidhya Raj", role: "Core Member", group: "Social Media Team" },
  { name: "Aarushi Raizada", role: "Core Member", group: "Social Media Team" },
  { name: "Utkarsh Agrawal", role: "Core Member", group: "Social Media Team" },
  { name: "Shrashti Bansal", role: "Core Member", group: "Social Media Team" },
  { name: "Indrayudh Paul", role: "Core Member", group: "Social Media Team" },
  { name: "Riddhima Gupta", role: "Core Member", group: "Social Media Team" },
  { name: "Aastha Sharma", role: "Core Member", group: "Social Media Team" },
  { name: "Dhanraj Choudhary", role: "Core Member", group: "Social Media Team" },
  { name: "Muskan Bhatia", role: "Core Member", group: "Social Media Team" },
  { name: "Abhinav Sharma", role: "Core Member", group: "Social Media Team" },
  { name: "Sohini Dutta", role: "Core Member", group: "Social Media Team" },
  { name: "Aashish", role: "Core Member", group: "Social Media Team" },
  { name: "N Nishchay Reddy", role: "Core Member", group: "Social Media Team" },

  // DESIGN TEAM
  { name: "Pranjal Tiwari", role: "Lead", group: "Design Team" },
  { name: "Aditya Pandey", role: "Co-Lead", group: "Design Team" },
  { name: "Ishani Sahay", role: "Co-Lead", group: "Design Team" },
  { name: "Saumya Dayal", role: "Core Member", group: "Design Team" },
  { name: "Vaibhav Santosh Tiwari", role: "Core Member", group: "Design Team" },
  { name: "Abhishek", role: "Core Member", group: "Design Team" },
  { name: "Drishti Singh", role: "Core Member", group: "Design Team" },
  { name: "Prisha Sharma", role: "Core Member", group: "Design Team" },

  // PHOTOGRAPHY TEAM
  { name: "Prabhav Sharma", role: "Lead", group: "Photography Team" },
  { name: "Neha A", role: "Core Member", group: "Photography Team" },
  { name: "Vaishnavi Gupta", role: "Core Member", group: "Photography Team" },
  { name: "Prince Gupta", role: "Core Member", group: "Photography Team" },
  { name: "Parimal Vinod Swami", role: "Core Member", group: "Photography Team" },

  // SOFTWARE DEV TEAM
  { name: "Neel Pandey", role: "Lead", group: "Software Dev Team" },
  { name: "Aarush Rahul Patel", role: "Co-Lead", group: "Software Dev Team" },
  { name: "Sanskar", role: "Co-Lead", group: "Software Dev Team" },
  { name: "Nikhil Kumar Tiwari", role: "Core Member", group: "Software Dev Team" },
  { name: "Shresth Bhargava", role: "Core Member", group: "Software Dev Team" },
  { name: "Tanishka", role: "Core Member", group: "Software Dev Team" },
  { name: "Ritik", role: "Core Member", group: "Software Dev Team" },
  { name: "Varun Saini", role: "Core Member", group: "Software Dev Team" },
  { name: "Rajnarayan", role: "Core Member", group: "Software Dev Team" },
  { name: "Anish", role: "Core Member", group: "Software Dev Team" },
  { name: "Ananya", role: "Core Member", group: "Software Dev Team" },
];

const departmentTabs = [
  "Panel",
  "Software Dev Team",
  "Technical Team",
  "Event Management Team",
  "Design Team",
  "Content Team",
  "PR & Outreach Team",
  "HR Team",
  "Social Media Team",
  "Photography Team",
  "All Members",
] as const;

export const TeamSection: React.FC = () => {
  const [activeGroup, setActiveGroup] = useState<string>("Panel");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const matchesGroup = activeGroup === "All Members" ? true : m.group === activeGroup;

      const matchesSearch =
        searchQuery.trim() === "" ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.group.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesGroup && matchesSearch;
    });
  }, [activeGroup, searchQuery]);

  return (
    <section id="team" className="w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3">
            <span className="size-8 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center font-mono text-xs font-bold text-[#0052cc] shadow-sm">
              04
            </span>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-[#0052cc]">
              <span className="size-1.5 rounded-full bg-[#0052cc]" />
              <span>CORE DOSSIER & ROSTER</span>
            </div>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-slate-900 mt-3 leading-none">
            MEET THE TEAM
          </h1>
          <p className="text-xs sm:text-sm font-mono text-slate-600 mt-2 max-w-xl">
            The presidents, domain leads, machine learning researchers, and developers orchestrating
            DSC VIT Bhopal.
          </p>
        </div>

        {/* Real-time Search Box */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[#0052cc]" />
          <input
            type="text"
            placeholder="Search member or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Filter Tabs Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-10 scrollbar-none">
        {departmentTabs.map((g) => {
          const count =
            g === "All Members"
              ? teamMembers.length
              : teamMembers.filter((m) => m.group === g).length;

          const isActive = activeGroup === g;

          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-all duration-300 cursor-pointer border ${
                isActive
                  ? "bg-[#0052cc] text-white border-[#0052cc] font-bold shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <span>{g}</span>
              <span className={`ml-2 text-[10px] ${isActive ? "text-white/80" : "text-[#0052cc]"}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredMembers.map((m) => (
          <div
            key={m.name}
            className="group relative rounded-3xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-blue-500 hover:shadow-[0_10px_30px_rgba(0,82,204,0.08)] hover:-translate-y-1 transition-all duration-300 ease-out"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#0052cc] font-bold bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                  {m.group.replace(" Team", "")}
                </span>
                <span className="size-2 rounded-full bg-blue-500/60 group-hover:bg-[#0052cc] transition-all" />
              </div>

              {/* Avatar & Ident */}
              <div className="flex items-center gap-4 my-2">
                <div className="size-14 rounded-2xl border border-slate-200 p-0.5 bg-blue-50 overflow-hidden group-hover:border-blue-400 group-hover:scale-105 transition-all duration-300 shrink-0">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=eff6ff&color=0052cc&bold=true&font-size=0.4`}
                    alt={m.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0052cc] transition-colors truncate">
                    {m.name}
                  </h3>
                  <p className="text-xs font-mono text-[#0052cc] font-semibold mt-0.5 truncate">
                    {m.role}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>VIT BHOPAL</span>
              <span className="text-blue-600 font-semibold">
                ACTIVE
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredMembers.length === 0 && (
        <div className="text-center py-20 rounded-3xl border border-slate-200 bg-slate-50 my-8">
          <Users className="size-10 text-[#0052cc] mx-auto mb-3 opacity-60" />
          <h3 className="text-xl font-bold text-slate-900">No members matched</h3>
          <p className="text-xs font-mono text-slate-600 mt-2">
            Try adjusting your search criteria or selecting a different department tab.
          </p>
        </div>
      )}

      {/* Recruitment Callout */}
      <div className="mt-16 rounded-3xl border border-slate-200 bg-slate-50/70 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left shadow-sm">
        <div className="space-y-2">
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
            WANT TO JOIN OUR ROSTER?
          </h3>
          <p className="text-xs sm:text-sm font-mono text-slate-600 max-w-xl">
            Core team applications are currently open across technical development, AI research,
            event ops, and creative design.
          </p>
        </div>

        <Link
          to="/join"
          className="inline-flex items-center gap-2 rounded-full bg-[#0052cc] px-8 py-3.5 text-xs font-mono font-bold tracking-wider text-white uppercase hover:bg-blue-700 hover:scale-[1.03] transition-all duration-300 shadow-md cursor-pointer shrink-0"
        >
          <span>APPLY FOR CORE TEAM</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
};

export default TeamSection;
