'use client';

import { useEffect, useState } from 'react';
import { ScrollText, Save, Loader2, AlertCircle, Eye, ArrowLeft, RotateCcw } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/pro-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export default function ManageHouseRulesPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useAppNavigation();
  
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalRules, setOriginalRules] = useState('');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || user.role !== 'Chủ nhà hàng') {
      nav.push('/'); 
      return;
    }

    const loadSettings = async () => {
      try {
        const settings = await dataStore.getAppSettings();
        const content = settings.houseRules || '';
        setRules(content);
        setOriginalRules(content);
      } catch (error) {
        console.error('Failed to load rules:', error);
        toast.error('Không thể tải nội quy');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user, authLoading, nav]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await dataStore.updateAppSettings({ houseRules: rules });
      setOriginalRules(rules);
      toast.success('Đã cập nhật nội quy thành công');
    } catch (error) {
      console.error('Failed to save rules:', error);
      toast.error('Không thể lưu nội quy');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = rules !== originalRules;

  if (authLoading || loading) {
    return <LoadingPage />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => nav.back()}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              Biên soạn <span className="text-primary">Nội quy</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed">Nội dung này sẽ hiển thị trực tiếp cho toàn bộ nhân viên ngay sau khi được lưu.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRules(originalRules)}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Hoàn tác
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={saving || !hasChanges} 
            className="rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 gap-2 px-6"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-none bg-transparent">
          <CardContent className="p-0">
            <Tabs defaultValue="edit" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-muted/50 p-1 rounded-xl">
                  <TabsTrigger value="edit" className="rounded-lg gap-2 px-4">
                    <ScrollText className="w-4 h-4" />
                    Chỉnh sửa
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="rounded-lg gap-2 px-4">
                    <Eye className="w-4 h-4" />
                    Xem trước
                  </TabsTrigger>
                </TabsList>
                
                {hasChanges && (
                  <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider animate-pulse">
                    Có thay đổi chưa lưu
                  </div>
                )}
              </div>

              <TabsContent value="edit" className="mt-0 focus-visible:outline-none">
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm h-[600px] md:h-[750px] flex flex-col">
                  <RichTextEditor
                    content={rules}
                    onChange={setRules}
                    placeholder="Bắt đầu soạn thảo nội quy tại đây..."
                    className="flex-1 border-none focus-within:ring-0 rounded-none shadow-none"
                    editorClassName="prose-headings:text-foreground prose-headings:font-black prose-headings:tracking-tighter
                      prose-h2:text-xl md:text-2xl prose-h2:border-l-4 prose-h2:border-primary prose-h2:pl-4 prose-h2:py-1 prose-h2:mt-8 prose-h2:mb-4 prose-h2:bg-primary/[0.03]
                      prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:font-bold
                      prose-p:leading-tight prose-p:text-foreground/80 prose-p:my-4 prose-p:text-[15px]
                      prose-li:leading-tight prose-li:text-foreground/80 prose-li:my-1.5 prose-li:marker:text-primary
                      prose-strong:text-foreground prose-strong:font-bold"
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-0 focus-visible:outline-none">
                <div className="bg-card border rounded-2xl p-6 md:p-10 shadow-sm h-[600px] md:h-[750px] overflow-auto">
                  {rules ? (
                    <div className="prose prose-neutral prose-sm md:prose-base dark:prose-invert max-w-none
                        prose-headings:font-black prose-headings:tracking-tight prose-headings:text-foreground
                        prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-1 prose-h2:border-b
                        prose-p:text-foreground/80 prose-p:leading-tight prose-p:my-4
                        prose-li:text-foreground/80 prose-li:my-1.5
                        prose-strong:text-foreground prose-strong:font-bold">
                      <ReactMarkdown>{rules}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-3">
                      <Eye className="w-12 h-12 opacity-10" />
                      <p className="italic">Chưa có nội dung để hiển thị</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="bg-primary/[0.03] border border-primary/10 rounded-[2rem] p-6 flex gap-5 items-start">
        <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="space-y-2">
          <p className="font-bold text-lg tracking-tight">Hướng dẫn biên soạn</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
              Sử dụng các thẻ tiêu đề (H1, H2) để phân tách các mục lớn.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
              Nên dùng danh sách (dấu chấm) cho các điều khoản cụ thể.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
              Thường xuyên nhấn "Xem trước" để kiểm tra trình bày.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
              Lưu thay đổi trước khi rời khỏi trang để tránh mất dữ liệu.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
