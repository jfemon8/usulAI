import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/AuthCard";
import { LoginForm } from "@/components/admin/auth/LoginForm";
import { redirectIfSignedIn } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "লগইন" };

export default async function AdminLoginPage() {
  await redirectIfSignedIn();
  return (
    <AuthCard
      title="প্যানেলে লগইন"
      description="অ্যাডমিন, মডারেটর এবং মুফতি, আলেম, ওলামা, ইমাম ও শায়েখগণ নিজের অ্যাকাউন্টে লগইন করুন। অ্যাকাউন্ট শুধু অ্যাডমিন তৈরি করতে পারেন।"
    >
      <LoginForm />
    </AuthCard>
  );
}
