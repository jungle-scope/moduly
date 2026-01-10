import Sidebar from '../features/dashboard/components/Sidebar';
import Header from '../features/dashboard/components/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Left: Sidebar (full height) */}
      <Sidebar />

      {/* Right: Header + Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      </div>
    </div>
  );
}
