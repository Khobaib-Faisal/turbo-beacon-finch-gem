import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DeskApp } from "@/components/desk";
import { ShellSkeleton, SignInPanel } from "@/components/sign-in-panel";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || isPending) return <ShellSkeleton />;
  if (!user) return <SignInPanel />;
  return <DeskApp />;
}
