import { Sidebar } from "./sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 w-full h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 md:px-8">
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Email System</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
