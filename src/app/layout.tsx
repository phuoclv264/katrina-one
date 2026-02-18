import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ProToastProvider } from '@/components/ui/pro-toast';
import { DialogProvider } from '@/contexts/dialog-context';
import { CapacitorUpdaterListener } from '@/components/capacitor-updater-listener';
import { CapacitorUpdater } from '@capgo/capacitor-updater'

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
  const notifyReady = async () => {
    try {
      console.log('CapacitorUpdater: notifyAppReady() — notifying native plugin that app is ready');
      await CapacitorUpdater.notifyAppReady();
      console.log('CapacitorUpdater: notifyAppReady() succeeded');
    } catch (err) {
      console.warn('CapacitorUpdater notifyAppReady failed', err);
      console.log('CapacitorUpdater: notifyAppReady() error', err);
    }
  };
  notifyReady().catch(() => { });
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="https://firebasestorage.googleapis.com/v0/b/katrinaone.firebasestorage.app/o/logo_coffee.png?alt=media&token=c4832ac1-b277-425e-9d35-8108cd2c3fe6" />
      </head>
      <body className="font-body antialiased">
        <DialogProvider>
          <CapacitorUpdaterListener />
          {children}
          <ProToastProvider />
        </DialogProvider>
      </body>
    </html>
  );
}
