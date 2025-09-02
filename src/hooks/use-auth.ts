
'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useToast } from './use-toast';

export type UserRole = 'staff' | 'manager';

export interface AuthUser extends User {
  displayName: string;
  role: UserRole;
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
          setUser({
            ...firebaseUser,
            displayName: userData.displayName,
            role: userData.role,
          } as AuthUser);

          // Redirect based on role after login
          if (pathname === '/') {
             if (userData.role === 'staff') {
                router.replace('/shifts');
            } else if (userData.role === 'manager') {
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

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle the redirect
      toast({ title: 'Đăng nhập thành công!' });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Lỗi đăng nhập',
        description: 'Email hoặc mật khẩu không chính xác.',
      });
      setLoading(false);
    }
  }, [toast]);

  const register = useCallback(async (email: string, password: string, displayName: string, role: UserRole) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email,
        displayName,
        role,
      });

      // onAuthStateChanged will handle the user state update and redirect
       toast({ title: 'Đăng ký thành công!', description: 'Đang chuyển hướng bạn...' });
    } catch (error: any) {
       console.error(error);
      toast({
        variant: 'destructive',
        title: 'Lỗi đăng ký',
        description: error.message,
      });
      setLoading(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
        await signOut(auth);
        router.push('/');
        toast({ title: 'Đã đăng xuất.' });
    } catch (error: any) {
         console.error(error);
         toast({
            variant: 'destructive',
            title: 'Lỗi',
            description: 'Không thể đăng xuất. Vui lòng thử lại.',
        });
    } finally {
        setLoading(false);
    }
  }, [router, toast]);
  
  return { 
      user, 
      loading,
      login, 
      register,
      logout, 
  };
};
