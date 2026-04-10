"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Mail,
  Send,
  BarChart3,
  Users,
  FileText,
  Eye,
  EyeOff,
  Lock,
  Shield,
} from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Logged in successfully");
        router.push("/");
        router.refresh();
      } else {
        toast.error(data.error || "Login failed");
      }
    } catch (error) {
      toast.error("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: <Send className="h-5 w-5" />,
      title: "Email Campaigns",
      description: "Create and manage automated email sequences",
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: "Contact Management",
      description: "Organize and track your leads effectively",
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: "Analytics Dashboard",
      description: "Monitor performance and engagement metrics",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Template Library",
      description: "Beautiful email templates at your fingertips",
    },
  ];

  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-8">
          <div className="space-y-2 text-center">
            <Image
              src="/company_logo.png"
              alt="Logo"
              width={150}
              height={150}
              className="mx-auto"
            />
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm lg:text-base">
              Enter your password to access the system
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium">
                Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoFocus
                  className="pl-10 pr-10 h-12 bg-background ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors px-1">
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              disabled={isLoading}>
              {isLoading ? "Verifying..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center space-y-4">
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contact your system administrator for assistance or access
                recovery
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
