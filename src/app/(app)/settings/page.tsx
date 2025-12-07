'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataStore } from '@/lib/data-store';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ManagedUser, AppSettings } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userTheme, setUserTheme] = useState<'default' | 'dark' | 'noel'>('default');
  const [globalTheme, setGlobalTheme] = useState<'default' | 'dark' | 'noel'>('default');
  const [noelVariant, setNoelVariant] = useState<'noel-1' | 'noel-2'>('noel-1');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch User Preference
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as ManagedUser;
          setUserTheme(userData.themePreference || 'default');
        }

        // Fetch Global Default
        const settings = await dataStore.getAppSettings();
        setGlobalTheme(settings.defaultTheme || 'default');
        setNoelVariant(settings.noelThemeVariant || 'noel-1');
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast.error("Không thể tải cài đặt.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleUserThemeChange = async (value: 'default' | 'dark' | 'noel') => {
    if (!user) return;
    setUserTheme(value);
    try {
      await dataStore.updateUserData(user.uid, { themePreference: value });
      toast.success("Đã cập nhật giao diện cá nhân.");
    } catch (error) {
      console.error("Error updating user theme:", error);
      toast.error("Lỗi khi lưu cài đặt.");
    }
  };

  const handleGlobalThemeChange = async (value: 'default' | 'dark' | 'noel') => {
    setGlobalTheme(value);
    try {
      await dataStore.updateAppSettings({ defaultTheme: value });
      toast.success("Đã cập nhật giao diện mặc định toàn hệ thống.");
    } catch (error) {
      console.error("Error updating global theme:", error);
      toast.error("Lỗi khi lưu cài đặt.");
    }
  };

  const handleNoelVariantChange = async (value: 'noel-1' | 'noel-2') => {
    setNoelVariant(value);
    try {
      await dataStore.updateAppSettings({ noelThemeVariant: value });
      toast.success("Đã cập nhật biến thể Noel.");
    } catch (error) {
      console.error("Error updating noel variant:", error);
      toast.error("Lỗi khi lưu cài đặt.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl space-y-8 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt</h1>
        <p className="text-muted-foreground">Quản lý giao diện và tùy chọn ứng dụng.</p>
      </div>

      <div className="grid gap-6">
        {/* User Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Giao diện cá nhân</CardTitle>
            <CardDescription>
              Chọn giao diện hiển thị cho tài khoản của bạn. Cài đặt này sẽ ghi đè cài đặt mặc định của hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="user-theme">Chủ đề</Label>
              <Select value={userTheme} onValueChange={(v) => handleUserThemeChange(v as any)}>
                <SelectTrigger id="user-theme">
                  <SelectValue placeholder="Chọn chủ đề" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Mặc định (Theo hệ thống)</SelectItem>
                  <SelectItem value="dark">Giao diện tối (Dark Mode)</SelectItem>
                  <SelectItem value="noel">Giáng sinh (Noel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Owner Settings */}
        {user?.role === 'Chủ nhà hàng' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Cài đặt hệ thống (Admin)</CardTitle>
              <CardDescription>
                Cài đặt này sẽ áp dụng cho tất cả nhân viên chưa chọn giao diện riêng.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="global-theme">Chủ đề mặc định</Label>
                <Select value={globalTheme} onValueChange={(v) => handleGlobalThemeChange(v as any)}>
                  <SelectTrigger id="global-theme">
                    <SelectValue placeholder="Chọn chủ đề mặc định" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Mặc định (Sáng)</SelectItem>
                    <SelectItem value="dark">Giao diện tối (Dark Mode)</SelectItem>
                    <SelectItem value="noel">Giáng sinh (Noel)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="noel-variant">Biến thể Noel</Label>
                <Select value={noelVariant} onValueChange={(v) => handleNoelVariantChange(v as any)}>
                  <SelectTrigger id="noel-variant">
                    <SelectValue placeholder="Chọn biến thể Noel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noel-1">Noel Cổ điển (Mới)</SelectItem>
                    <SelectItem value="noel-2">Noel Tươi sáng (Cũ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
