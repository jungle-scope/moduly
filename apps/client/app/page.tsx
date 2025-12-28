import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          테스트용 임시 페이지
        </h1>

        <div className="space-y-4">
          <Link
            href="/dashboard"
            className="block w-full py-3 px-6 text-center text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Dashboard로 이동
          </Link>

          <Link
            href="/auth/login"
            className="block w-full py-3 px-6 text-center text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
          >
            Login으로 이동
          </Link>

          <Link
            href="/workflows/1"
            className="block w-full py-3 px-6 text-center text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
          >
            Workflow/1로 이동
          </Link>

          <Link
            href="/settings"
            className="block w-full py-3 px-6 text-center text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
          >
            Settings로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
