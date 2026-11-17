import type { Metadata } from "next";
import { PasswordRecovery } from "@/components/password-recovery";

export const metadata: Metadata = { title: "Відновлення доступу | ZORIA", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() { return <PasswordRecovery mode="request" />; }
