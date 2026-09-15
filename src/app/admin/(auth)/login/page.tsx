import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/AuthCard";
import { LoginForm } from "@/components/admin/auth/LoginForm";
import { redirectIfSignedIn } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "লগইন" };

export default async function AdminLoginPage() {
  await redirectIfSignedIn();
  return (
    <AuthCard
      title="অ্যাডমিন লগইন"
      description="সাইট, AI কনটেন্ট ও রিসোর্স পরিচালনা করতে আপনার অ্যাডমিন অ্যাকাউন্টে লগইন করুন।"
    >
      <LoginForm />
    </AuthCard>
  );
}
