
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/hooks/use-auth';
import { toast } from 'react-hot-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { dataStore } from '@/lib/data-store';
import type { AppSettings } from '@/lib/types';


export default function AuthPage() {
  const { user, login, register, loading } = useAuth();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole | ''>('');


  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setIsProcessingAuth(true);
    const success = await login(loginEmail, loginPassword);
    if (!success) {
      setIsProcessingAuth(false);
    }
    // On success, isProcessingAuth remains true while the redirect happens.
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
     if (!registerEmail || !registerPassword || !registerName || !registerRole) {
      toast.error('Vui lòng điền đầy đủ thông tin, bao gồm cả vai trò.');
      return;
    }
    setIsProcessingAuth(true);

    try {
        const settings = await dataStore.getAppSettings();
        if (settings.isRegistrationEnabled === false) {
          toast.error('Tính năng đăng ký đã tắt. Vui lòng liên hệ chủ nhà hàng để được hỗ trợ tạo tài khoản.', { duration: 5000 });
          setIsProcessingAuth(false);
          return;
        }

        const success = await register(registerEmail, registerPassword, registerName, registerRole);
        if (!success) {
            setIsProcessingAuth(false);
        }
    } catch (error) {
        console.error("Registration check failed", error);
        toast.error('Không thể kiểm tra cài đặt đăng ký. Vui lòng thử lại.');
        setIsProcessingAuth(false);
    }
  };
  
  if (loading && !user) {
    return (
       <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Đang tải...</p>
      </div>
    )
  }

  const isProcessing = loading || isProcessingAuth;

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-4 text-center mb-8">
        <Image src="https://firebasestorage.googleapis.com/v0/b/katrinaone.firebasestorage.app/o/logo_coffee.png?alt=media&token=2d84d1e1-b65f-47fd-bb66-e96cde25aa0d" alt="Katrina One Logo" width={1419} height={304} className="h-auto w-48" />
        <p className="text-muted-foreground max-w-sm">
          Hệ thống quản lý công việc và báo cáo hàng ngày.
        </p>
      </div>

      <Tabs defaultValue="login" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Đăng nhập</TabsTrigger>
          <TabsTrigger value="register">Đăng ký</TabsTrigger>
        </TabsList>
        
        {/* Login Tab */}
        <TabsContent value="login">
          <Card className="relative">
             {isProcessing && (
              <div className="absolute inset-0 z-10 bg-white/70 dark:bg-black/70 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader>
              <CardTitle>Chào mừng trở lại</CardTitle>
              <CardDescription>Đăng nhập vào tài khoản của bạn để tiếp tục.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="email@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required disabled={isProcessing} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Mật khẩu</Label>
                  <div className="relative">
                     <Input 
                        id="login-password" 
                        type={showLoginPassword ? "text" : "password"} 
                        value={loginPassword} 
                        onChange={(e) => setLoginPassword(e.target.value)} 
                        required 
                        disabled={isProcessing} 
                        className="pr-10"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowLoginPassword(prev => !prev)}
                        disabled={isProcessing}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showLoginPassword ? "Ẩn" : "Hiện"} mật khẩu</span>
                      </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Đăng nhập
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register Tab */}
        <TabsContent value="register">
          <Card className="relative">
            {isProcessing && (
              <div className="absolute inset-0 z-10 bg-white/70 dark:bg-black/70 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader>
              <CardTitle>Tạo tài khoản mới</CardTitle>
              <CardDescription>Điền thông tin bên dưới để tạo tài khoản.</CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Tên hiển thị</Label>
                  <Input id="register-name" placeholder="Ví dụ: Phước" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required disabled={isProcessing}/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input id="register-email" type="email" placeholder="email@example.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required disabled={isProcessing}/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Mật khẩu</Label>
                   <div className="relative">
                      <Input 
                          id="register-password" 
                          type={showRegisterPassword ? "text" : "password"} 
                          value={registerPassword} 
                          onChange={(e) => setRegisterPassword(e.target.value)} 
                          required 
                          disabled={isProcessing}
                          className="pr-10"
                      />
                       <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowRegisterPassword(prev => !prev)}
                        disabled={isProcessing}
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showRegisterPassword ? "Ẩn" : "Hiện"} mật khẩu</span>
                      </Button>
                   </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="register-role">Vai trò</Label>
                    <Select onValueChange={(value) => setRegisterRole(value as UserRole)} disabled={isProcessing} value={registerRole}>
                        <SelectTrigger id="register-role">
                            <SelectValue placeholder="Chọn vai trò của bạn" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Phục vụ">Phục vụ</SelectItem>
                            <SelectItem value="Pha chế">Pha chế</SelectItem>
                            <SelectItem value="Thu ngân">Thu ngân</SelectItem>
                            <SelectItem value="Quản lý">Quản lý</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button type="submit" className="w-full" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Đăng ký
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
