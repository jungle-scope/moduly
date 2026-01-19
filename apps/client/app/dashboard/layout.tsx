import Sidebar from '../features/dashboard/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-white p-4 gap-4 font-sans">
      {/* Left: Sidebar (Floating) */}
      <Sidebar />

      {/* Right: Main Content (Floating) */}
      <div className="flex flex-col flex-1 overflow-hidden rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white ring-1 ring-black/5 relative z-0">
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          {children}
        </main>
      </div>
    </div>
  );
}
