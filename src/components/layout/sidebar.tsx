"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  LayoutDashboard,
  History,
  Mail,
  Menu,
  X,
  Globe,
  Send,
  FileText,
  Settings,
  Reply,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Sequences", href: "/sequences", icon: Mail },
  { name: "Templates", href: "/templates", icon: FileText },
  { name: "Email Replies", href: "/email-replies", icon: Reply },
  { name: "Senders", href: "/senders", icon: Send },
  { name: "Countries", href: "/countries", icon: Globe },
  { name: "History", href: "/history", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <div className="p-1.5 bg-primary text-primary-foreground rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                EmailSystem
              </span>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}>
                  <item.icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
