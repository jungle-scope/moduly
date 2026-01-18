'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Zap, Workflow, BarChart3, BookOpen } from 'lucide-react';

export default function DashboardHomePage() {
  const router = useRouter();

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">환영합니다!</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Moduly와 함께 모듈을 구축하고 자동화하세요
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {/* Create Module Card */}
          <button
            onClick={() => router.push('/dashboard/mymodule')}
            className="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200 text-left"
          >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-5 h-5 text-blue-600" />
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              내 모듈
            </h3>
            <p className="text-gray-600 text-sm">
              나만의 AI 모듈을 생성하고 관리하세요
            </p>
          </button>

          {/* Explore Marketplace Card */}
          <button
            onClick={() => router.push('/dashboard/explore')}
            className="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-purple-200 text-left"
          >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-5 h-5 text-purple-600" />
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <Workflow className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              마켓플레이스
            </h3>
            <p className="text-gray-600 text-sm">
              다른 사용자들이 만든 모듈을 탐색하세요
            </p>
          </button>

          {/* Statistics Card */}
          <button
            onClick={() => router.push('/dashboard/statistics')}
            className="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-green-200 text-left"
          >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-5 h-5 text-green-600" />
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">통계</h3>
            <p className="text-gray-600 text-sm">
              사용 현황과 성과를 확인하세요
            </p>
          </button>

          {/* Knowledge DB Card */}
          <button
            onClick={() => router.push('/dashboard/knowledge')}
            className="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 text-left"
          >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-5 h-5 text-orange-600" />
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              지식 관리
            </h3>
            <p className="text-gray-600 text-sm">
              지식을 관리하세요
            </p>
          </button>
        </div>

        {/* Getting Started Section */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">시작하기</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">모듈 생성</h3>
                <p className="text-sm text-gray-600">
                  '내 모듈' 페이지에서 새로운 AI 모듈을 만들어보세요
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">모듈 구성</h3>
                <p className="text-sm text-gray-600">
                  드래그 앤 드롭으로 모듈을 쉽게 구성하세요
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  테스트 및 배포
                </h3>
                <p className="text-sm text-gray-600">
                  모듈을 테스트하고 마켓플레이스에 공유하세요
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold">
                4
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">모니터링</h3>
                <p className="text-sm text-gray-600">
                  통계 페이지에서 성과를 추적하고 개선하세요
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
