import React from "react";
import { Link } from "@tanstack/react-router";
import { Cpu, Database, Layout, BarChart3, ArrowRight, Terminal } from "lucide-react";

const domainList = [
  {
    num: "01",
    code: "DOMAIN // ML-01",
    title: "Machine Learning",
    icon: Cpu,
    tagline: "Neural Architectures & Generative AI",
    desc: "Building production deep learning models, fine-tuning transformers, computer vision pipelines, and deploying edge AI inference engines.",
    skills: ["PyTorch", "HuggingFace", "CUDA", "LLMs", "Vision Transformers"],
  },
  {
    num: "02",
    code: "DOMAIN // DE-02",
    title: "Data Engineering",
    icon: Database,
    tagline: "Distributed Pipelines & Big Data",
    desc: "Developing high-throughput ETL pipelines, vector search clusters, real-time streaming architectures, and resilient cloud data lakes.",
    skills: ["Apache Spark", "Kafka", "PostgreSQL", "Vector DBs", "Docker"],
  },
  {
    num: "03",
    code: "DOMAIN // DEV-03",
    title: "Interactive Dev",
    icon: Layout,
    tagline: "Next-Gen Web & Computational Interfaces",
    desc: "Crafting reactive frontend architectures, responsive 3D web platforms, performant APIs, and developer tools for the DSC community.",
    skills: ["React / Next.js", "TypeScript", "Tailwind CSS", "GSAP / Three.js", "REST/GraphQL"],
  },
  {
    num: "04",
    code: "DOMAIN // AD-04",
    title: "Analytics Depth",
    icon: BarChart3,
    tagline: "Statistical Inferences & Predictive Modeling",
    desc: "Unlocking empirical signals from high-dimensional datasets, hypothesis testing, quantitative research, and decision intelligence dashboards.",
    skills: ["Pandas / NumPy", "Scikit-Learn", "Tableau", "Bayesian Stats", "Forecasting"],
  },
];

export const SiloDomains: React.FC = () => {
  return (
    <section
      id="domains"
      className="w-full py-8 sm:py-14 px-4 sm:px-8 max-w-7xl mx-auto"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
        <div>
          <div className="flex items-center gap-3">
            <span className="size-8 rounded-xl border-2 border-blue-600 bg-blue-50 flex items-center justify-center font-mono text-xs font-bold text-blue-700 shadow-xs">
              02
            </span>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-blue-700 font-bold">
              <span>RESEARCH DIVISIONS</span>
            </div>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-slate-900 mt-3 font-sans">
            OUR CORE DOMAINS
          </h2>
          <p className="text-xs sm:text-sm font-mono text-slate-600 mt-2 max-w-xl">
            Specialized engineering squads operating across deep learning, high-throughput systems,
            modern interactive frontends, and statistical modeling.
          </p>
        </div>

        <div>
          <Link
            to="/about"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 hover:border-blue-600 bg-white hover:bg-blue-50 px-6 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-800 hover:text-blue-700 transition-all uppercase cursor-pointer shadow-xs"
          >
            <span>LEARN OUR METHODOLOGY</span>
            <ArrowRight className="size-3.5 text-blue-600" />
          </Link>
        </div>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {domainList.map((dom) => {
          const Icon = dom.icon;
          return (
            <div
              key={dom.num}
              className="group relative rounded-3xl border-2 border-slate-200 bg-white p-8 sm:p-10 flex flex-col justify-between hover:border-blue-600 hover:shadow-xl hover:shadow-blue-600/10 transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-xs">
                      <Icon className="size-6" />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-700 tracking-wider">
                        {dom.code}
                      </span>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight font-sans">
                        {dom.title}
                      </h3>
                    </div>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-200 group-hover:text-blue-200 transition-colors">
                    {dom.num}
                  </span>
                </div>

                <div className="pt-6 space-y-3">
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-mono text-xs font-bold border border-blue-200">
                    {dom.tagline}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed">
                    {dom.desc}
                  </p>
                </div>
              </div>

              {/* Skills Footer */}
              <div className="pt-8 mt-6 border-t border-slate-200">
                <span className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-2 font-bold">
                  CORE INFRASTRUCTURE:
                </span>
                <div className="flex flex-wrap gap-2">
                  {dom.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-mono text-xs font-medium hover:border-blue-300 transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
