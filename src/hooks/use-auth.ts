
'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useToast } from './use-toast';

export type UserRole = 'Phục vụ' | 'Pha chế' | 'Quản lý' | 'Chủ nhà hàng';

export interface AuthUser extends User {
  displayName: string;
  role: UserRole;
  secondaryRoles?: UserRole[];
}

export const useAuth = () => {
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userRole = userData.role as UserRole;
          const authUser = {
            ...firebaseUser,
            displayName: userData.displayName,
            role: userRole,
            secondaryRoles: userData.secondaryRoles || [],
          } as AuthUser;
          setUser(authUser);

          // Redirect based on role after login or on page load
          if (pathname === '/') {
             if (userRole === 'Phục vụ') {
                router.replace('/shifts');
            } else if (userRole === 'Pha chế') {
                router.replace('/bartender');
            } else if (userRole === 'Quản lý') {
                router.replace('/manager');
            } else if (userRole === 'Chủ nhà hàng') {
                router.replace('/reports');
            }
          }

        } else {
            // This case might happen if user document creation fails after registration.
            // For now, we log them out.
            await signOut(auth);
            setUser(null);
        }
      } else {
        setUser(null);
        if (pathname !== '/') {
            router.replace('/');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle the redirect
      toast({ title: 'Đăng nhập thành công!' });
      return true;
    } catch (error: any) {
      console.error(error);
      let description = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
      if (error.code === 'auth/invalid-credential') {
        description = 'Email hoặc mật khẩu không chính xác.';
      }
      toast({
        variant: 'destructive',
        title: 'Lỗi đăng nhập',
        description: description,
      });
      return false;
    }
  }, [toast]);

  const register = useCallback(async (email: string, password: string, displayName: string, role: UserRole): Promise<boolean> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email,
        displayName,
        role,
        secondaryRoles: [],
      });

      // onAuthStateChanged will handle the user state update and redirect
       toast({ title: 'Đăng ký thành công!', description: 'Đang chuyển hướng bạn...' });
       return true;
    } catch (error: any) {
       console.error(error);
      toast({
        variant: 'destructive',
        title: 'Lỗi đăng ký',
        description: error.message,
      });
      return false;
    }
  }, [toast]);

  const logout = useCallback(async () => {
    try {
        await signOut(auth);
        router.replace('/');
        toast({ title: 'Đã đăng xuất.' });
    } catch (error: any) {
         console.error(error);
         toast({
            variant: 'destructive',
            title: 'Lỗi',
            description: 'Không thể đăng xuất. Vui lòng thử lại.',
        });
    }
  }, [toast, router]);
  
  return { 
      user, 
      loading,
      login, 
      register,
      logout, 
  };
};
