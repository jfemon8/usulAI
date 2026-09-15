import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/admin/AuthCard";
import { ForgotPasswordForm } from "@/components/admin/auth/ForgotPasswordForm";
import { ADMIN_CONFIG } from "@/config/site";
import { redirectIfSignedIn } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "পাসওয়ার্ড ভুলে গেছেন" };

export default async function ForgotPasswordPage() {
  await redirectIfSignedIn();
  return (
    <AuthCard
      title="পাসওয়ার্ড রিসেট"
      description="আপনার অ্যাডমিন ইমেইল দিন। পাসওয়ার্ড রিসেটের একটি লিংক সেই ইমেইলে পাঠানো হবে।"
      footer={
        <Link href={ADMIN_CONFIG.paths.login} className="text-(--accent) hover:underline">
          লগইন পেজে ফিরুন
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
