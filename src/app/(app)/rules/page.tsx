'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScrollText, Loader2, AlertCircle, Edit3, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dataStore } from '@/lib/data-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useAuth } from '@/hooks/use-auth';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function HouseRulesPage() {
  const { user } = useAuth();
  const nav = useAppNavigation();
  const [rules, setRules] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = dataStore.subscribeToAppSettings((settings) => {
      setRules(settings.houseRules || '');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="container max-w-4xl mx-auto p-3 md:p-6 space-y-4 pb-20"
    >
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary/[0.08] via-background to-background border p-5 md:p-7 shadow-sm">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
          <ScrollText size={100} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-primary/80">
              <ScrollText className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Hệ thống</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground leading-none">
              Nội quy <span className="text-primary italic">Lao động</span>
            </h1>
            <p className="text-foreground/60 text-sm md:text-base leading-tight max-w-md">
              Hướng dẫn và quy chuẩn đạo đức nghề nghiệp dành cho tất cả thành viên.
            </p>
          </div>

          {user?.role === 'Chủ nhà hàng' && (
            <Button 
              variant="outline" 
              onClick={() => nav.push('/rules/manage')}
              className="rounded-xl border-dashed hover:border-primary hover:text-primary transition-all group shrink-0"
            >
              <Edit3 className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
              Chỉnh sửa nội quy
            </Button>
          )}
        </div>
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
              bg-card border rounded-[2rem] p-5 md:p-8 shadow-sm"
            >
              <ReactMarkdown>{rules}</ReactMarkdown>
            </div>

            <div className="flex items-center justify-center py-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              <div className="px-5 text-[9px] font-black text-foreground/20 uppercase tracking-[0.5em]">
                Kết thúc tài liệu
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="rounded-[2rem] bg-muted/30 border-2 border-dashed p-16 flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center shadow-sm">
                <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h2 className="text-2xl font-bold tracking-tight">Thông báo quan trọng</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Hiện tại danh sách nội quy đang được cập nhật. Vui lòng quay lại sau hoặc liên hệ trực tiếp với quản lý để biết thêm chi tiết.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
