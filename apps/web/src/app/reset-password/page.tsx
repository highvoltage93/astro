import type { Metadata } from "next";
import { PasswordRecovery } from "@/components/password-recovery";

export const metadata: Metadata = { title: "Новий пароль | ZORIA", robots: { index: false, follow: false } };

export default function ResetPasswordPage() { return <PasswordRecovery mode="reset" />; }
