import "./globals.css";
import React from "react";

export const metadata = {
  title: "批量图片水印工具",
  description: "上传图片或目录，批量添加水印并打包下载",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
