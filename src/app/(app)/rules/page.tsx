'use client';

import { useEffect, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  ScrollText, 
  Loader2, 
  AlertCircle, 
  Edit3, 
  ArrowLeft, 
  Users, 
  Crown, 
  ShieldCheck, 
  Coffee, 
  Utensils, 
  Wallet, 
  Plus, 
  X,
  PlusCircle,
  Trophy,
  Zap,
  Heart,
  Star,
  Settings2,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dataStore } from '@/lib/data-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useAuth } from '@/hooks/use-auth';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/user-avatar';
import { ManagedUser, UserBadge, UserRole } from '@/lib/types';
import { BadgeAssignmentDialog } from '@/components/badge-assignment-dialog';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

const ROLE_ORDER: UserRole[] = [
  'Chủ nhà hàng',
  'Quản lý',
  'Thu ngân',
  'Pha chế',
  'Phục vụ'
];

const ROLE_ICONS: Record<UserRole, any> = {
  'Chủ nhà hàng': Crown,
  'Quản lý': ShieldCheck,
  'Thu ngân': Wallet,
  'Pha chế': Coffee,
  'Phục vụ': Utensils
};

const ROLE_COLORS: Record<UserRole, string> = {
  'Chủ nhà hàng': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  'Quản lý': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  'Thu ngân': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  'Pha chế': 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  'Phục vụ': 'text-purple-500 bg-purple-500/10 border-purple-500/20'
};

export default function HouseRulesPage() {
  const { user } = useAuth();
  const nav = useAppNavigation();
  const [rules, setRules] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [isBadgeDialogOpen, setIsBadgeDialogOpen] = useState(false);

  useEffect(() => {
    const unsubSettings = dataStore.subscribeToAppSettings((settings) => {
      setRules(settings.houseRules || '');
    });

    const unsubUsers = dataStore.subscribeToUsers((newUsers) => {
      // Filter out resigned users for the hierarchy view
      setUsers(newUsers.filter(u => u.employmentStatus !== 'Nghỉ việc'));
      setLoading(false);
    }, { includeResigned: false });

    return () => {
      unsubSettings();
      unsubUsers();
    };
  }, []);

  const groupedUsers = useMemo(() => {
    return ROLE_ORDER.map(role => ({
      role,
      users: users.filter(u => u.role === role)
    })).filter(group => group.users.length > 0);
  }, [users]);

  const handleGrantBadge = async (u: ManagedUser, label: string, color?: string) => {
    if (!user) return;
    
    const newBadge: UserBadge = {
      id: uuidv4(),
      label,
      grantedAt: Date.now(),
      grantedBy: user.uid
    };

    if (color) newBadge.color = color;

    const currentBadges = u.badges || [];
    if (currentBadges.some(b => b.label === label)) {
      toast({
        title: "Lỗi",
        description: "Người dùng đã có huy hiệu này rồi!",
        variant: "destructive"
      });
      return;
    }

    try {
      await dataStore.updateUserData(u.uid, {
        badges: [...currentBadges, newBadge]
      });
      toast({
        title: "Thành công",
        description: `Đã trao huy hiệu "${label}" cho ${u.displayName}`,
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật huy hiệu",
        variant: "destructive"
      });
    }
  };

  const handleRemoveBadge = async (u: ManagedUser, badgeId: string) => {
    const currentBadges = u.badges || [];
    try {
      await dataStore.updateUserData(u.uid, {
        badges: currentBadges.filter(b => b.id !== badgeId)
      });
      toast({
        title: "Đã xóa huy hiệu",
        description: `Huy hiệu đã được gỡ bỏ khỏi ${u.displayName}`,
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa huy hiệu",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="container max-w-4xl mx-auto p-3 md:p-6 space-y-8 pb-20"
    >
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/[0.08] via-background to-background border p-6 md:p-10 shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
          <ScrollText size={120} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary/80">
              <ScrollText className="w-5 h-5" />
              <span className="text-[12px] font-black uppercase tracking-[0.4em]">Hệ thống</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground leading-none">
               Katrina <span className="text-primary italic">& Team</span>
            </h1>
            <p className="text-foreground/60 text-sm md:text-lg leading-tight max-w-md">
              Hướng dẫn quy chuẩn và danh sách thành viên trong ngôi nhà Katrina.
            </p>
          </div>

          {user?.role === 'Chủ nhà hàng' && (
            <Button 
              variant="outline" 
              onClick={() => nav.push('/rules/manage')}
              className="rounded-2xl border-dashed h-12 px-6 hover:border-primary hover:text-primary transition-all group shrink-0"
            >
              <Edit3 className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
              Thiết lập nội quy
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-12">
        {/* Rules Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">Nội quy lao động</h2>
          </div>

          <AnimatePresence mode="wait">
            {rules ? (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid gap-3"
              >
                <div className="prose prose-neutral dark:prose-invert max-w-none 
                  prose-headings:text-foreground prose-headings:font-black prose-headings:tracking-tighter
                  prose-h2:text-xl md:text-2xl prose-h2:border-l-4 prose-h2:border-primary prose-h2:pl-4 prose-h2:py-1 prose-h2:mt-8 prose-h2:mb-4 prose-h2:bg-primary/[0.03]
                  prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:font-bold
                  prose-p:leading-tight prose-p:text-foreground/80 prose-p:my-4 prose-p:text-[15px]
                  prose-li:text-foreground/80 prose-li:my-1.5 prose-li:marker:text-primary
                  prose-strong:text-foreground prose-strong:font-bold
                  bg-card border rounded-[2.5rem] p-6 md:p-10 shadow-sm"
                >
                  <ReactMarkdown>{rules}</ReactMarkdown>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="rounded-[2.5rem] bg-muted/30 border-2 border-dashed p-16 flex flex-col items-center text-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center shadow-sm">
                    <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h2 className="text-2xl font-bold tracking-tight">Cập nhật nội quy</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Thông tin này đang được ban quản lý cập nhật để phù hợp với định hướng mới.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Staff Hierarchy Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">Sơ đồ nhân sự</h2>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 font-bold">
              {users.length} thành viên
            </Badge>
          </div>

          <div className="space-y-8">
            {groupedUsers.map((group) => {
              const Icon = ROLE_ICONS[group.role];
              return (
                <div key={group.role} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <Icon className={cn("w-4 h-4", ROLE_COLORS[group.role].split(' ')[0])} />
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      {group.role}
                    </h3>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.users.map((u) => (
                      <Card key={u.uid} className="rounded-2xl border-none shadow-none bg-muted/30 overflow-hidden relative group">
                        <CardContent className="p-4 flex items-center gap-4">
                          <UserAvatar user={u} size="w-12 h-12" rounded="xl" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm">{u.displayName}</h4>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {u.badges?.map(badge => (
                                <Badge 
                                  key={badge.id}
                                  variant="secondary"
                                  className={cn(
                                    "text-[9px] px-1.5 h-4 text-white border-none font-bold transition-colors duration-200",
                                    badge.color ? `${badge.color} hover:opacity-80` : "bg-primary hover:bg-primary/90"
                                  )}
                                >
                                  {badge.label}
                                  {user?.role === 'Chủ nhà hàng' && (
                                    <button 
                                      onClick={() => handleRemoveBadge(u, badge.id)}
                                      className="ml-1 hover:text-destructive transition-colors"
                                    >
                                      <X className="w-2 h-2" />
                                    </button>
                                  )}
                                </Badge>
                              ))}
                              {user?.role === 'Chủ nhà hàng' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setIsBadgeDialogOpen(true);
                                  }}
                                  className="h-4 w-4 rounded-full p-0 flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                                >
                                  <PlusCircle className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <BadgeAssignmentDialog
        open={isBadgeDialogOpen}
        onOpenChange={setIsBadgeDialogOpen}
        selectedUser={selectedUser}
        onGrantBadge={handleGrantBadge}
        parentDialogTag="root"
      />

      <div className="flex items-center justify-center py-10">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="px-5 text-[9px] font-black text-foreground/20 uppercase tracking-[0.5em]">
          Katrina One Staff System
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </motion.div>
  );
}
