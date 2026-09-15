"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/admin/ui";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icons";

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pe-11" />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-xl text-(--text-3) hover:text-(--text-1)"
      >
        {visible ? (
          <EyeOffIcon className="h-[1.125rem] w-[1.125rem]" />
        ) : (
          <EyeIcon className="h-[1.125rem] w-[1.125rem]" />
        )}
      </button>
    </div>
  );
}
