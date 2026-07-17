import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "業務管理システム",
  appleWebApp: {
    title: "業務管理システム",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#012074",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">
        <RegisterServiceWorker />
        {/* ホーム画面から起動した(PWAとしてインストール済みの)時だけ表示する起動画面 */}
        <div className="pwa-splash">
          <img src="/icons/icon-192.png" alt="" className="pwa-splash-icon" />
          <div className="pwa-splash-title">業務管理</div>
          <div className="pwa-splash-subtitle">勤怠・売上・帳票管理</div>
          <div className="pwa-splash-spinner" />
        </div>
        {children}
      </body>
    </html>
  );
}
