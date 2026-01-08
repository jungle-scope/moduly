import WorkflowLayoutHeader from '../../features/workflow/components/WorkflowLayoutHeader';

export default function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Header */}
      <WorkflowLayoutHeader />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
