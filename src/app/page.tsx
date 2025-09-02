
'use client';

import { useState } from 'react';
import { Building, KeyRound, Loader2, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export default function AuthPage() {
  const { user, login, register, loading } = useAuth();
  const { toast } = useToast();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập email và mật khẩu.', variant: 'destructive' });
      return;
    }
    await login(loginEmail, loginPassword);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
     if (!registerEmail || !registerPassword || !registerName) {
      toast({ title: 'Lỗi', description: 'Vui lòng điền đầy đủ thông tin.', variant: 'destructive' });
      return;
    }
    // Hardcode role to 'staff'
    await register(registerEmail, registerPassword, registerName, 'staff');
  };
  
  if (loading && !user) {
    return (
       <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Đang tải...</p>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-2 text-center mb-8">
        <KeyRound className="h-12 w-12 text-primary" />
        <h1 className="text-4xl font-bold text-primary font-headline">Katrina One</h1>
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
          <Card>
            <CardHeader>
              <CardTitle>Chào mừng trở lại</CardTitle>
              <CardDescription>Đăng nhập vào tài khoản của bạn để tiếp tục.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="email@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required disabled={loading} />
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
                        disabled={loading} 
                        className="pr-10"
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowLoginPassword(prev => !prev)}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showLoginPassword ? "Ẩn" : "Hiện"} mật khẩu</span>
                      </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Đăng nhập
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register Tab */}
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Tạo tài khoản nhân viên</CardTitle>
              <CardDescription>Điền thông tin bên dưới để tạo tài khoản mới.</CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Tên hiển thị</Label>
                  <Input id="register-name" placeholder="Ví dụ: Phước" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required disabled={loading}/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input id="register-email" type="email" placeholder="email@example.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required disabled={loading}/>
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
                          disabled={loading}
                          className="pr-10"
                      />
                       <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowRegisterPassword(prev => !prev)}
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showRegisterPassword ? "Ẩn" : "Hiện"} mật khẩu</span>
                      </Button>
                   </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Đăng ký
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <footer className="absolute bottom-4 text-xs text-muted-foreground">
        Xây dựng với Firebase và Genkit
      </footer>
    </main>
  );
}
