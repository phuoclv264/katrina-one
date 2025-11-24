
'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { dataStore } from '@/lib/data-store';
import { useDataRefresher } from './useDataRefresher';
import { isUserOnActiveShift, getActiveShifts } from '@/lib/schedule-utils';
import type { Schedule, AssignedShift } from '@/lib/types';
import { getISOWeek, format } from 'date-fns';

export type UserRole = 'Phục vụ' | 'Pha chế' | 'Quản lý' | 'Chủ nhà hàng' | 'Thu ngân';

export interface AuthUser extends User {
  displayName: string;
  role: UserRole;
  secondaryRoles?: UserRole[];
  anonymousName?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnActiveShift, setIsOnActiveShift] = useState(false);
  const [activeShifts, setActiveShifts] = useState<AssignedShift[]>([]);
  const [todaysShifts, setTodaysShifts] = useState<AssignedShift[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const loadingTimer = useRef<NodeJS.Timeout | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useDataRefresher(handleDataRefresh);
  const checkUserShift = useCallback((firebaseUser: AuthUser | null, schedule: Schedule | null) => {
    if (!firebaseUser || firebaseUser.role === 'Chủ nhà hàng') {
      setIsOnActiveShift(true);
      setActiveShifts([]);
      setTodaysShifts([]);
      return;
    }

    if (!schedule || schedule.status !== 'published') {
      setIsOnActiveShift(false);
      setActiveShifts([]);
      setTodaysShifts([]);
      return;
    }

    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const assignedShiftsToday: AssignedShift[] = schedule.shifts
      .filter(shift => shift.date === todayKey && shift.assignedUsers.some(u => u.userId === firebaseUser.uid))
      .sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
    
    setTodaysShifts(assignedShiftsToday);
    setIsOnActiveShift(isUserOnActiveShift(assignedShiftsToday));
    setActiveShifts(getActiveShifts(assignedShiftsToday));
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
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
            anonymousName: userData.anonymousName,
          } as AuthUser;
          setUser(authUser);

          if (pathname === '/') {
             if (userRole === 'Phục vụ') router.replace('/shifts');
             else if (userRole === 'Pha chế') router.replace('/bartender');
             else if (userRole === 'Quản lý') router.replace('/manager');
             else if (userRole === 'Chủ nhà hàng') router.replace('/admin');
             else if (userRole === 'Thu ngân') router.replace('/cashier');
          }

        } else {
            await signOut(auth);
            setUser(null);
            setIsOnActiveShift(false);
            setActiveShifts([]);
            setTodaysShifts([]);
            if (pathname !== '/') router.replace('/');
        }
      } else {
        setUser(null);
        setIsOnActiveShift(false);
        setActiveShifts([]);
        setTodaysShifts([]);
        if (pathname !== '/') router.replace('/');
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [pathname, router]);

  useEffect(() => {
    if (!user) {
        setIsOnActiveShift(false);
        setActiveShifts([]);
        setTodaysShifts([]);
        return;
    };

    const today = new Date();
    const weekId = `${today.getFullYear()}-W${getISOWeek(today)}`;

    const unsubscribeSchedule = dataStore.subscribeToSchedule(weekId, (schedule) => {
        checkUserShift(user, schedule);
    });

    return () => {
        unsubscribeSchedule();
    };
  }, [user, checkUserShift, refreshTrigger]);

  useEffect(() => {
    // Clear any existing timer
    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
    }

    if (loading) {
      loadingTimer.current = setTimeout(() => {
        // If still loading after 15 seconds, something is wrong.
        // Let's show a toast and reload the page.
        toast.error('Quá trình xác thực mất quá nhiều thời gian. Đang thử lại...');
        router.push('/');
      }, 15000); // 15 seconds
    }
    return () => {
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
    };
  }, [loading]);
  
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Đăng nhập thành công!');
      return true;
    } catch (error: any) {
      console.error(error);
      let description = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
      if (error.code === 'auth/invalid-credential') {
        description = 'Email hoặc mật khẩu không chính xác.';
      }
      toast.error(description);
      return false;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string, role: UserRole): Promise<boolean> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email,
        displayName,
        role,
        secondaryRoles: [],
      });

       toast.success('Đăng ký thành công! Đang chuyển hướng bạn...');
       return true;
    } catch (error: any) {
       console.error(error);
      let errorMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email này đã được sử dụng.';
      }
      toast.error(errorMessage);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
        await signOut(auth);
        router.replace('/');
        toast.success('Đã đăng xuất.');
    } catch (error: any) {
         console.error(error);
         toast.error('Không thể đăng xuất. Vui lòng thử lại.');
    }
  }, [router]);
  
  return { 
      user, 
      loading,
      isOnActiveShift,
      activeShifts,
      todaysShifts,
      login, 
      register,
      logout,
  };
};
