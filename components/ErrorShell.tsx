"use client";

import type React from "react";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  AlertTriangle,
  ShieldAlert,
  Ban,
  CircleX,
  Clock,
  Home,
  Mail,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import Image from "next/image";

type Variant = "404" | "401" | "403" | "429" | "500";

const VARIANTS: Record<
  Variant,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    ring: string;
    tone: string;
    badge: string;
  }
> = {
  "404": {
    label: "404",
    icon: AlertTriangle,
    gradient: "from-emerald-100 via-emerald-50 to-white",
    ring: "ring-emerald-200",
    tone: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  },
  "401": {
    label: "401",
    icon: ShieldAlert,
    gradient: "from-amber-100 via-amber-50 to-white",
    ring: "ring-amber-200",
    tone: "text-amber-700",
    badge: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200",
  },
  "403": {
    label: "403",
    icon: Ban,
    gradient: "from-zinc-100 via-zinc-50 to-white",
    ring: "ring-zinc-200",
    tone: "text-zinc-800",
    badge: "bg-zinc-100 text-zinc-900 ring-1 ring-inset ring-zinc-200",
  },
  "429": {
    label: "429",
    icon: Clock,
    gradient: "from-orange-100 via-orange-50 to-white",
    ring: "ring-orange-200",
    tone: "text-orange-700",
    badge: "bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-200",
  },
  "500": {
    label: "500",
    icon: CircleX,
    gradient: "from-rose-100 via-rose-50 to-white",
    ring: "ring-rose-200",
    tone: "text-rose-700",
    badge: "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-200",
  },
};

interface ErrorShellProps {
  variant?: Variant;
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  extraHref?: string;
  extraLabel?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  illustrationQuery?: string;
}

export default function ErrorShell({
  variant = "500",
  title = "Something went wrong",
  description = "An unexpected error occurred. If the issue persists, please contact support.",
  primaryHref = "/",
  primaryLabel = "Back to Home",
  showRetry = false,
  onRetry,
}: ErrorShellProps) {
  const v = VARIANTS[variant];
  const Icon = v.icon;

  return (
    <div className="relative  min-h-dvh overflow-hidden">
      <Header />
      {/* Background */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b",
          v.gradient
        )}
      />
      {/* Soft radial spotlight */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute -top-24 left-1/2 -z-10 h-[480px] w-[480px] -translate-x-1/2 rounded-full blur-3xl opacity-40",
          {
            "bg-emerald-200": variant === "404",
            "bg-amber-200": variant === "401",
            "bg-zinc-300": variant === "403",
            "bg-rose-200": variant === "500",
            "bg-orange-200": variant === "429",
          }
        )}
      />

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center h-screen gap-10 px-6 py-12 md:grid-cols-2 md:py-20">
        {/* Left: Text + Actions */}
        <section className="order-2 md:order-1">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm shadow-sm ring-1 ring-inset bg-white/80 backdrop-blur-sm border border-white/40">
            <span className={cn("font-semibold", v.tone)}>{v.label}</span>
            <span className="h-1 w-1 rounded-full bg-neutral-300" />
            <span className="text-neutral-600">
              Cavite State University Bacoor City Campus Student Portal
            </span>
          </div>

          <div className="mb-6 flex items-start gap-3">
            <div
              className={cn(
                "rounded-xl p-2 bg-white/80 backdrop-blur-sm shadow-sm",
                v.ring
              )}
            >
              <Icon className={cn("h-6 w-6", v.tone)} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-neutral-600">{description}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {showRetry && (
              <Button
                onClick={onRetry}
                className="gap-2 bg-blue-700 hover:bg-blue-600"
              >
                <RefreshCw className="h-4 w-4" />
                {"Try again"}
              </Button>
            )}
            <Link href={primaryHref} className="w-full sm:w-auto">
              <Button variant="outline" className="w-full gap-2 bg-white/70">
                <Home className="h-4 w-4" />
                {primaryLabel}
              </Button>
            </Link>
          </div>
          {/* <div className="mt-6 text-sm text-neutral-600">
            Need assistance?{" "}
            <Link
              href={extraHref}
              className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
            >
              <Mail className="h-3.5 w-3.5" />
              {extraLabel}
            </Link>
          </div> */}
        </section>

        {/* Right: Illustration / Visual */}
        <section className="order-1 md:order-2">
          <div className="relative">
            <div
              className={cn(
                "absolute -inset-4 -z-10 rounded-2xl opacity-60 blur-xl",
                v.ring
              )}
            />
            {/* <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <Image
                src={`/placeholder.svg?height=380&width=560&query=${illustrationQuery}`}
                alt="Illustration representing the student portal"
                className="h-auto w-full object-cover"
              />
            </div> */}
            {/* <div className="mt-3 flex items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-1 text-xs", v.badge)}>
                {"Campus resources · Registrar · Help Desk"}
              </span>
            </div> */}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <nav className="flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="h-5 w-5 text-emerald-700" />
          <span>
            {"Cavite State University Bacoor City Campus Student Portal"}
          </span>
        </Link>
        {/* <div className="hidden items-center gap-4 text-sm text-neutral-600 sm:flex">
          <Link href="/help" className="hover:underline underline-offset-4">
            {"Help Center"}
          </Link>
        </div> */}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-4 text-sm text-neutral-600 sm:flex-row">
        <p className="order-2 sm:order-1">
          {"© "} {new Date().getFullYear()}{" "}
          {
            "Cavite State University Bacoor City Campus Student Portal · Registrar"
          }
        </p>
        <div className="order-1 flex items-center gap-4 sm:order-2">
          {/* <Link href="/policies" className="hover:underline underline-offset-4">
            {"Policies"}
          </Link>
          <Link href="/status" className="hover:underline underline-offset-4">
            {"System Status"}
          </Link> */}
        </div>
      </div>
    </footer>
  );
}
