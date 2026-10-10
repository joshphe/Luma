import type { Metadata } from 'next';
import './globals.css';
import './compare.css';
import './enhance.css';
import './split.css';
import './collage.css';
import './notification-template.css';

export const metadata: Metadata = {
  title: 'Luma · 本地图片工作台',
  description: '一个轻快、私密的本地图片滤镜工具。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
