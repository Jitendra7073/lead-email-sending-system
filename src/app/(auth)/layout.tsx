import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header only - No sidebar */}
      <header className="sticky top-0 z-20 w-full h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 md:px-8">
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Email System</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Login page content */}
      <main className="flex-1 flex items-center justify-center">
        {children}
      </main>
    </div>
  );
}
