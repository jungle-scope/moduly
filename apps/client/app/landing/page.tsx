'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  ChevronRight,
  Database,
  DollarSign,
  FileText,
  FolderOpen,
  Github,
  GitFork,
  Globe,
  Layout,
  MessageSquare,
  MousePointerClick,
  Play,
  Plus,
  Search,
  TrendingUp,
  Users2,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ----------------------------------------------------------------------
// Mock Components for Tab Content
// ----------------------------------------------------------------------

function DataView() {
  const knowledgeBases = [
    {
      id: 'kb-1',
      name: '고객 지원 센터',
      description: 'FAQ, 상담 스크립트, 제품 정책',
      sourceTypes: ['FILE', 'API'],
      documentCount: 28,
      updatedAt: '2시간 전',
    },
    {
      id: 'kb-2',
      name: 'DB 연동 지식베이스',
      description: 'CRM/주문 DB를 RAG로 바로 검색',
      sourceTypes: ['DB', 'API'],
      documentCount: 42,
      updatedAt: '방금 전',
      tag: 'DB 연동',
      tagClassName: 'bg-purple-50 text-purple-700 border-purple-100',
    },
    {
      id: 'kb-3',
      name: '세일즈 플레이북',
      description: '제안서, 케이스 스터디',
      sourceTypes: ['FILE'],
      documentCount: 15,
      updatedAt: '5일 전',
    },
  ];

  const sourceTypeMeta = {
    FILE: {
      label: '파일',
      badgeClass: 'bg-blue-100',
      iconClass: 'text-blue-600',
      Icon: FileText,
    },
    API: {
      label: 'API',
      badgeClass: 'bg-green-100',
      iconClass: 'text-green-600',
      Icon: Webhook,
    },
    DB: {
      label: 'DB',
      badgeClass: 'bg-purple-100',
      iconClass: 'text-purple-600',
      Icon: Database,
    },
  } as const;

  return (
    <div className="w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-4">지식 관리</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="지식베이스 검색"
              className="w-56 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            새 지식 베이스
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 pt-4">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {knowledgeBases.map((kb, index) => (
            <div
              key={kb.id}
              className={cn(
                'group flex items-center gap-4 p-5 hover:bg-gray-50 transition-all cursor-pointer',
                index !== knowledgeBases.length - 1
                  ? 'border-b border-gray-200'
                  : '',
              )}
            >
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shrink-0">
                <FolderOpen className="w-6 h-6" />
              </div>

              <div className="flex-1 min-w-0 ml-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {kb.name}
                </h3>
                {kb.tag ? (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                      kb.tagClassName,
                    )}
                  >
                    {kb.tag}
                  </span>
                ) : null}
              </div>
                <p className="text-sm text-gray-500 truncate mt-1">
                  {kb.description}
                </p>

                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  {kb.sourceTypes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center -space-x-1.5">
                        {kb.sourceTypes.map((type) => {
                          const meta =
                            sourceTypeMeta[
                              type as keyof typeof sourceTypeMeta
                            ];
                          if (!meta) return null;
                          const Icon = meta.Icon;
                          return (
                            <div
                              key={`${kb.id}-${type}`}
                              className="relative z-10 bg-white rounded-full p-0.5"
                              title={meta.label}
                            >
                              <div
                                className={cn(
                                  'p-1 rounded-full',
                                  meta.badgeClass,
                                )}
                              >
                                <Icon
                                  className={cn('w-3 h-3', meta.iconClass)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <span className="w-px h-3 bg-gray-300 mx-1"></span>
                    </div>
                  )}

                  <span>자료 {kb.documentCount}개</span>

                  <span className="w-px h-3 bg-gray-300 mx-1"></span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{kb.updatedAt} 업데이트</span>
                  </div>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type NodePreviewProps = {
  title: string;
  icon: ReactNode;
  iconColor: string;
  children?: ReactNode;
};

function NodePreview({
  title,
  icon,
  iconColor,
  children,
}: NodePreviewProps) {
  return (
    <div className="relative w-[180px] min-h-[72px] rounded-[16px] border-2 border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-1.5 flex items-center gap-2.5">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ backgroundColor: iconColor }}
        >
          {icon}
        </div>
        <div className="flex flex-col">
          <h3 className="text-[13px] font-bold text-gray-900 leading-none">
            {title}
          </h3>
        </div>
      </div>

      {children ? <div className="text-[11px]">{children}</div> : null}
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
      <div className="relative w-[740px] h-[300px] scale-[0.78] sm:scale-[0.9] md:scale-100 origin-center">
        {/* Node 1: Start */}
        <div className="absolute top-[16px] left-[20px] z-10 animate-in fade-in zoom-in duration-500">
          <NodePreview
            title="입력"
            icon={<Play className="w-3.5 h-3.5 text-white fill-current" />}
            iconColor="#3b82f6"
          />
        </div>

        {/* Node 2: LLM */}
        <div className="absolute top-[96px] left-[280px] z-10 animate-in fade-in zoom-in duration-700 delay-100">
          <NodePreview
            title="LLM"
            icon={<Bot className="w-3.5 h-3.5 text-white" />}
            iconColor="#a855f7"
          />
        </div>

        {/* Node 3: Answer */}
        <div className="absolute top-[176px] left-[540px] z-10 animate-in fade-in zoom-in duration-1000 delay-200">
          <NodePreview
            title="응답"
            icon={<MessageSquare className="w-3.5 h-3.5 text-white" />}
            iconColor="#10b981"
          />
        </div>

        {/* Connections Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <marker
              id="node-arrow"
              markerWidth="16"
              markerHeight="16"
              refX="14"
              refY="8"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polyline
                points="4,2 13,8 4,14"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          </defs>

          {/* Connection 1: Start -> LLM */}
          <path
            d="M 200 58 C 240 58, 220 132, 270 132"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeLinecap="round"
            markerEnd="url(#node-arrow)"
          />

          {/* Connection 2: LLM -> Answer */}
          <path
            d="M 460 132 C 500 132, 480 206, 530 206"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeLinecap="round"
            markerEnd="url(#node-arrow)"
          />
        </svg>
      </div>
    </div>
  );
}

function ReportingView() {
  const maxCostRuns = [
    { id: 'run-1', time: '02-12 14:23', cost: 0.008421, tokens: 2240 },
    { id: 'run-2', time: '02-11 10:05', cost: 0.006912, tokens: 1984 },
    { id: 'run-3', time: '02-10 18:42', cost: 0.005604, tokens: 1721 },
  ];

  const minCostRuns = [
    { id: 'run-4', time: '02-12 08:12', cost: 0.000312, tokens: 221 },
    { id: 'run-5', time: '02-11 16:37', cost: 0.000448, tokens: 305 },
    { id: 'run-6', time: '02-10 09:01', cost: 0.000512, tokens: 388 },
  ];

  const recentFailures = [
    {
      time: '02-12 09:14:32',
      node: 'LLM',
      icon: <Bot className="w-4 h-4" />,
      badgeClass: 'text-purple-600 bg-purple-50',
      error: 'Rate limit exceeded (429)',
    },
    {
      time: '02-11 22:05:10',
      node: 'Webhook',
      icon: <Webhook className="w-4 h-4" />,
      badgeClass: 'text-indigo-600 bg-indigo-50',
      error: 'Invalid signature header',
    },
    {
      time: '02-10 15:29:44',
      node: '조건',
      icon: <GitFork className="w-4 h-4" />,
      badgeClass: 'text-amber-600 bg-amber-50',
      error: 'Case match failed: status',
    },
  ];

  const failureAnalysis = [
    {
      node: 'LLM',
      icon: <Bot className="w-4 h-4" />,
      badgeClass: 'text-purple-600 bg-purple-50',
      count: '8회',
      reason: '모델 요청 제한 초과',
    },
    {
      node: 'Webhook',
      icon: <Webhook className="w-4 h-4" />,
      badgeClass: 'text-indigo-600 bg-indigo-50',
      count: '5회',
      reason: '서명 검증 실패',
    },
    {
      node: '조건',
      icon: <GitFork className="w-4 h-4" />,
      badgeClass: 'text-amber-600 bg-amber-50',
      count: '3회',
      reason: '필수 입력값 누락',
    },
  ];

  return (
    <div className="w-full h-full bg-gray-100 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="h-full w-full overflow-y-auto p-4">
        <div className="space-y-4">
          {/* 비용 효율성 분석 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                비용 효율성 분석
              </h3>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase mb-1">
                      평균 비용 / Run
                    </p>
                    <h4 className="text-2xl font-bold text-gray-900">
                      $0.002381
                    </h4>
                  </div>
                  <div className="p-2.5 bg-white rounded-full shadow-sm">
                    <DollarSign className="w-5 h-5 text-amber-500" />
                  </div>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                      평균 토큰 / Run
                    </p>
                    <h4 className="text-2xl font-bold text-gray-900">
                      1,284
                      <span className="text-sm font-normal text-gray-500 ml-1">
                        tokens
                      </span>
                    </h4>
                  </div>
                  <div className="p-2.5 bg-white rounded-full shadow-sm">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                    최다 비용 발생 실행 사례
                  </h4>
                  <div className="space-y-2">
                    {maxCostRuns.map((run) => (
                      <div
                        key={run.id}
                        className="bg-gray-50 hover:bg-red-50 border border-transparent p-3 rounded-lg transition-all group"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-500">
                            {run.time}
                          </span>
                          <span className="text-sm font-bold text-red-600">
                            ${run.cost.toFixed(6)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 text-right">
                          <span className="flex items-center gap-1 justify-end">
                            토큰: {run.tokens.toLocaleString()}
                            <MousePointerClick className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                    <ArrowDownRight className="w-4 h-4 text-green-500" />
                    최소 비용 발생 실행 사례
                  </h4>
                  <div className="space-y-2">
                    {minCostRuns.map((run) => (
                      <div
                        key={run.id}
                        className="bg-gray-50 hover:bg-green-50 border border-transparent p-3 rounded-lg transition-all group"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-500">
                            {run.time}
                          </span>
                          <span className="text-sm font-bold text-green-600">
                            ${run.cost.toFixed(6)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 text-right">
                          <span className="flex items-center gap-1 justify-end">
                            토큰: {run.tokens.toLocaleString()}
                            <MousePointerClick className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 실행 추이 */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              실행 추이 (최근 30일)
            </h3>
            <div className="h-[200px] w-full">
              <svg viewBox="0 0 600 200" className="w-full h-full">
                <defs>
                  <linearGradient id="reportingRuns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity="0.15" />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[40, 80, 120, 160].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="600"
                    y2={y}
                    stroke="#f1f5f9"
                  />
                ))}
                <path
                  d="M 0 160 C 60 110, 120 180, 180 140 C 240 95, 300 110, 360 70 C 420 35, 480 80, 540 55 C 570 45, 590 60, 600 50 L 600 190 L 0 190 Z"
                  fill="url(#reportingRuns)"
                />
                <path
                  d="M 0 160 C 60 110, 120 180, 180 140 C 240 95, 300 110, 360 70 C 420 35, 480 80, 540 55 C 570 45, 590 60, 600 50"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">총 실행</span>
                  <span className="text-xs text-blue-500">(Total Runs)</span>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-gray-800">
                1,248
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">성공률</span>
                  <span className="text-xs text-green-500">(Success Rate)</span>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-gray-800">
                98.4%
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Clock className="w-5 h-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">평균 소요 시간</span>
                  <span className="text-xs text-purple-500">(Avg Time)</span>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-gray-800">
                2.14
                <span className="text-sm font-medium text-gray-500 ml-1">
                  초
                </span>
              </div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <DollarSign className="w-5 h-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">총 비용</span>
                  <span className="text-xs text-amber-500">(Total Cost)</span>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-gray-800">
                $12.340812
              </div>
            </div>
          </div>

          {/* 최근 실패 사례 */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              최근 실패 사례 (Live)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-red-50/50">
                  <tr>
                    <th className="px-4 py-3">발생 시간</th>
                    <th className="px-4 py-3">실패 노드</th>
                    <th className="px-4 py-3">에러 메시지</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentFailures.map((fail) => (
                    <tr
                      key={fail.time}
                      className="hover:bg-red-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-600">
                        {fail.time}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium ${fail.badgeClass}`}
                        >
                          {fail.icon}
                          {fail.node}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-red-600 break-all max-w-xs truncate"
                        title={fail.error}
                      >
                        {fail.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 실패 원인 분석 */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              실패 원인 분석 (Top 5 Nodes)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 whitespace-nowrap">노드</th>
                    <th className="px-6 py-3 whitespace-nowrap">실패 횟수</th>
                    <th className="px-6 py-3 whitespace-nowrap">
                      주요 실패 원인
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failureAnalysis.map((item) => (
                    <tr
                      key={item.node}
                      className="bg-white border-b hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <span
                          className={`inline-flex items-center gap-2 px-2 py-1 rounded ${item.badgeClass}`}
                        >
                          {item.icon}
                          {item.node}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600">
                        {item.count}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {item.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunityView() {
  const marketplaceItems = [
    {
      id: 'm1',
      name: '고객 상담 자동 요약',
      description: '채팅 로그를 요약하고 CRM에 자동 기록합니다.',
      rating: 4.8,
      downloads: 1840,
      color: 'from-blue-500 to-indigo-500',
    },
    {
      id: 'm2',
      name: '리드 스코어링 파이프라인',
      description: '웹훅 → LLM → 슬랙 알림까지 풀 오토메이션.',
      rating: 4.6,
      downloads: 1292,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      id: 'm3',
      name: 'RAG 기반 상품 추천',
      description: '지식베이스를 연결해 추천 응답을 생성합니다.',
      rating: 4.7,
      downloads: 956,
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'm4',
      name: '문서 QA 봇',
      description: '내부 문서를 학습해 정확한 답변을 제공합니다.',
      rating: 4.5,
      downloads: 801,
      color: 'from-amber-500 to-orange-500',
    },
    {
      id: 'm5',
      name: '세일즈 이메일 생성기',
      description: '템플릿과 변수로 맞춤형 이메일을 만듭니다.',
      rating: 4.4,
      downloads: 652,
      color: 'from-sky-500 to-cyan-500',
    },
    {
      id: 'm6',
      name: '슬랙 데일리 리포트',
      description: '실행 통계를 요약해 팀 채널로 전송합니다.',
      rating: 4.3,
      downloads: 532,
      color: 'from-slate-500 to-gray-500',
    },
  ];

  return (
    <div className="w-full h-full bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm flex flex-col">
      <div className="p-5 border-b border-gray-100 bg-white/70 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-800 text-base">
              마켓플레이스
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              검증된 모듈을 복제해 바로 사용하세요
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="모듈 검색..."
              className="w-52 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto">
        {marketplaceItems.map((item) => (
          <div
            key={item.id}
            className="group flex cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.color}`}
              >
                <Layout className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                  {item.name}
                </h4>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-yellow-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {item.rating.toFixed(1)}
                  </div>
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {item.downloads.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
              {item.description}
            </p>
            <div className="mt-4 border-t border-gray-100 pt-4 flex gap-2">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900">
                상세 보기
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900">
                복제하기
              </button>
            </div>
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
            오케스트레이션을 <br />실현합니다. 코딩 없이 복잡한 AI 프로세스를
            설계하고 비즈니스를 혁신하세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 text-white rounded-xl font-medium shadow-lg shadow-slate-200 hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
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
      </main>
    </div>
  );
}
