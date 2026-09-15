import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/admin/AuthCard";
import { ResetPasswordForm } from "@/components/admin/auth/ResetPasswordForm";
import { ADMIN_CONFIG } from "@/config/site";

export const metadata: Metadata = { title: "নতুন পাসওয়ার্ড" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthCard
      title="নতুন পাসওয়ার্ড সেট করুন"
      description={`নতুন পাসওয়ার্ড অন্তত ${ADMIN_CONFIG.minPasswordChars} অক্ষরের হতে হবে। সেট করার পর সব ডিভাইস থেকে লগআউট হয়ে যাবে।`}
      footer={
        <Link href={ADMIN_CONFIG.paths.login} className="text-(--accent) hover:underline">
          লগইন পেজে ফিরুন
        </Link>
      }
    >
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthCard>
  );
}
