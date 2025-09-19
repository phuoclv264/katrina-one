import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Katrina One',
  description: 'Ứng dụng nội bộ dành riêng cho nhân viên hệ thống Katrina Coffee, giúp quản lý công việc hiệu quả và kết nối dễ dàng hơn. Ứng dụng hỗ trợ nhân viên báo cáo ca làm, theo dõi nhiệm vụ, và nâng cao hiệu suất làm việc hằng ngày.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="https://firebasestorage.googleapis.com/v0/b/katrinaone.firebasestorage.app/o/logo_coffee.png?alt=media&token=d32a3b76-55ff-41f4-984f-a2c2742b6532" />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
