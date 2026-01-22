export default function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
