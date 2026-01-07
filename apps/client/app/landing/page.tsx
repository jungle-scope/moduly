'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  Github,
  Globe,
  Layout,
  MessageSquare,
  Play,
  Share2,
  Users2,
  Workflow,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, if not I'll implement a simple one or just classNames

// ----------------------------------------------------------------------
// Mock Components for Tab Content
// ----------------------------------------------------------------------

function DataView() {
  return (
    <div className="w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
      {/* Fake Header/Toolbar */}
      <div className="h-12 border-b border-gray-200 flex items-center px-4 gap-4 bg-gray-50/50">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600 shadow-sm">
          <Database className="w-4 h-4 text-blue-500" />
          <span>All Leads</span>
        </div>
        <div className="h-4 w-[1px] bg-gray-300" />
        <div className="text-sm text-gray-500">Sorted by Created Date</div>
      </div>
      {/* Fake Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="w-full border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                {
                  name: 'Acme Corp',
                  status: 'In Progress',
                  value: '$12,000',
                  color: 'blue',
                },
                {
                  name: 'Global Tech',
                  status: 'Qualified',
                  value: '$45,000',
                  color: 'green',
                },
                {
                  name: 'Stark Ind',
                  status: 'New',
                  value: '$8,500',
                  color: 'gray',
                },
                {
                  name: 'Wayne Ent',
                  status: 'Negotiation',
                  value: '$120,000',
                  color: 'purple',
                },
                {
                  name: 'Cyberdyne',
                  status: 'Contacted',
                  value: '$3,200',
                  color: 'yellow',
                },
              ].map((row, i) => (
                <tr
                  key={i}
                  className="group hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-${row.color}-50 text-${row.color}-700 border border-${row.color}-100`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.value}</td>
                  <td className="px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600">
                      U{i + 1}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NodesView() {
  return (
    <div className="w-full h-full bg-slate-50 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group flex items-center justify-center">
      {/* Dotted Grid Background */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      ></div>

      {/* Fixed Visualization Container */}
      <div className="relative w-[800px] h-[400px]">
        {/* Node 1: New Lead */}
        <div className="absolute top-[50px] left-[50px] z-10">
          <div className="bg-white px-4 py-3 rounded-xl border border-blue-200 shadow-sm flex items-center gap-3 w-48 animate-in fade-in zoom-in duration-500">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Zap className="w-4 h-4 text-fill" />
            </div>
            <div className="text-sm font-semibold text-gray-800">New Lead</div>
          </div>
        </div>

        {/* Node 2: Enrich Data */}
        <div className="absolute top-[150px] left-[300px] z-10">
          <div className="bg-white px-4 py-3 rounded-xl border border-purple-200 shadow-sm flex items-center gap-3 w-48 animate-in fade-in zoom-in duration-700 delay-100">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <Github className="w-4 h-4" />
            </div>
            <div className="text-sm font-semibold text-gray-800">
              Enrich Data
            </div>
          </div>
        </div>

        {/* Node 3: Slack Notify */}
        <div className="absolute top-[250px] left-[550px] z-10">
          <div className="bg-white px-4 py-3 rounded-xl border border-green-200 shadow-sm flex items-center gap-3 w-48 animate-in fade-in zoom-in duration-1000 delay-200">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="text-sm font-semibold text-gray-800">
              Slack Notify
            </div>
          </div>
        </div>

        {/* Connections Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {/* Connection 1: New Lead -> Enrich Data */}
          <path
            d="M 242 78 C 280 78, 260 178, 300 178"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="animate-pulse"
          />

          {/* Connection 2: Enrich Data -> Slack Notify */}
          <path
            d="M 492 178 C 520 178, 520 278, 550 278"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="animate-pulse delay-75"
          />
        </svg>
      </div>
    </div>
  );
}

function ReportingView() {
  return (
    <div className="w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm p-6 grid grid-cols-2 gap-4">
      <div className="col-span-2 flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">Pipeline Performance</h3>
        <div className="px-3 py-1 bg-gray-100 rounded-md text-xs text-gray-600">
          Last 30 Days
        </div>
      </div>

      {/* Chart 1 */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-col justify-end h-48 relative">
        <div className="text-xs text-gray-500 absolute top-3 left-3">
          Revenue
        </div>
        <div className="flex items-end gap-2 h-32 pl-4 pb-2">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-blue-500 rounded-t-sm hover:bg-blue-600 transition-colors"
              style={{ height: `${h}%` }}
            ></div>
          ))}
        </div>
      </div>

      {/* Chart 2 */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-col justify-end h-48 relative">
        <div className="text-xs text-gray-500 absolute top-3 left-3">
          Conversion Rate
        </div>
        <div className="flex items-center justify-center h-full">
          <div className="relative w-24 h-24 rounded-full border-8 border-gray-200 border-t-blue-500 border-r-blue-500 transform rotate-45">
            <div className="absolute inset-0 flex items-center justify-center transform -rotate-45">
              <span className="text-xl font-bold text-gray-800">72%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunityView() {
  return (
    <div className="w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-semibold text-gray-800">Community Templates</h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4 overflow-auto">
        {[
          { title: 'SaaS Sales CRM', author: 'Moduly Team', stars: 240 },
          { title: 'Hiring Pipeline', author: 'Sarah K.', stars: 185 },
          { title: 'Bug Tracking', author: 'Dev Guild', stars: 150 },
          { title: 'Content Calendar', author: 'Media Co', stars: 120 },
          { title: 'Investor Relations', author: 'Startup Inc', stars: 95 },
          { title: 'Event Planning', author: 'Community Mgr', stars: 80 },
        ].map((item, i) => (
          <div
            key={i}
            className="p-3 border border-gray-100 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all bg-white group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600">
                <Layout className="w-4 h-4" />
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1 group-hover:text-blue-500">
                <Users2 className="w-3 h-3" />
                {item.stars}
              </div>
            </div>
            <h4 className="font-medium text-gray-800 text-sm mb-1">
              {item.title}
            </h4>
            <p className="text-xs text-gray-500">by {item.author}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Landing Page Component
// ----------------------------------------------------------------------

export default function LandingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('nodes'); // Default tab

  const tabs = [
    { id: 'rag', label: 'RAG', icon: Database },
    { id: 'nodes', label: 'Nodes', icon: Workflow },
    { id: 'reporting', label: 'Reporting', icon: BarChart3 },
    { id: 'community', label: 'Community', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100">
      {/* ------------------- Navbar ------------------- */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 lg:px-8 px-4 h-16 flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-24 h-8">
              <Image
                src="/moduly-logo.png"
                alt="Moduly"
                fill
                className="object-contain object-left"
              />
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            {['Platform', 'Solutions', 'Customers', 'Pricing'].map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/jungle-scope/moduly"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors mr-2"
          >
            <Github className="w-5 h-5" />
            <span>4.2k</span>
          </a>
          <Link
            href="/auth/login"
            className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-md transition-all"
          >
            Start for free
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-20">
        {/* ------------------- Hero Section ------------------- */}
        <section className="container mx-auto px-4 text-center max-w-5xl mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="flex h-2 w-2 rounded-full bg-blue-600"></span>
            Explore our new AI Features
            <ChevronRight className="w-3 h-3" />
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            Modular AI System <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              magic.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Moduly는 직관적인 노드와 유연한 모듈 시스템으로 강력한 LLM
            오케스트레이션을 실현합니다. 코딩 없이 복잡한 AI 프로세스를 설계하고
            비즈니스를 혁신하세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 text-white rounded-xl font-medium shadow-lg shadow-slate-200 hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-300 transition-all">
              Talk to sales
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500 animate-in fade-in duration-1000 delay-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span>14-day free trial</span>
            </div>
          </div>
        </section>

        {/* ------------------- Interactive Feature Tab Section ------------------- */}
        <section className="container mx-auto px-4 max-w-6xl">
          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center border-b border-slate-200 mb-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative px-6 py-4 text-sm font-medium transition-all duration-200 flex items-center gap-2 border-b-2',
                    isActive
                      ? 'text-blue-600 border-blue-600 bg-blue-50/30'
                      : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50',
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isActive ? 'text-blue-600' : 'text-slate-400',
                    )}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content Display */}
          <div className="bg-slate-50/50 rounded-b-3xl border-x border-b border-slate-200/60 p-4 md:p-8 min-h-[500px]">
            <div className="relative w-full h-[500px] shadow-2xl shadow-slate-200/50 rounded-xl overflow-hidden bg-white border border-slate-200 transition-all duration-500">
              {/* Content Switcher */}
              {activeTab === 'rag' && <DataView />}
              {activeTab === 'nodes' && <NodesView />}
              {activeTab === 'reporting' && <ReportingView />}
              {activeTab === 'community' && <CommunityView />}
            </div>
          </div>
        </section>

        {/* ------------------- Social Proof / Footer-ish ------------------- */}
        <section className="py-20 text-center container mx-auto px-4">
          <p className="text-slate-500 font-medium mb-8">
            Trusted by innovative teams worldwide
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Fake Logos using Text for simplicity */}
            {[
              'Acme Corp',
              'Global Dynamics',
              'Interstellar',
              'Massive Dynamic',
              'Soylent Corp',
            ].map((name) => (
              <span
                key={name}
                className="text-xl font-bold font-serif text-slate-800"
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
