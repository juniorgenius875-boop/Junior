"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else router.replace(profile?.role === "admin" ? "/admin" : "/dashboard");
  }, [user, profile, loading, router]);

  return <div className="center-screen"><div className="loader" /></div>;
}
