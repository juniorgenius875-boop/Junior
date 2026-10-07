"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PageSkeleton } from "@/components/LoadingUI";

export default function RequireAuth({ children, admin = false }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (admin && profile?.role !== "admin") router.replace("/dashboard");
  }, [user, profile, loading, admin, router]);

  if (loading || !user || (admin && profile?.role !== "admin")) {
    return <PageSkeleton cards={6}/>;
  }

  return children;
}
