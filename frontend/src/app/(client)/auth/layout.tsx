export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-secondary via-bg-primary to-bg-primary flex flex-col">
      {children}
    </div>
  );
}
