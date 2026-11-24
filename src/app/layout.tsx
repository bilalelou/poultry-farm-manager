import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "دجاجتي - إدارة مزرعة الدواجن",
  description: "تطبيق متكامل لإدارة مشروع تربية الدجاج لإنتاج البيض وتسيير الفقاسة",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800">
        {children}
      </body>
    </html>
  );
}
