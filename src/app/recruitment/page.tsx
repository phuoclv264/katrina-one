'use client';

import { RecruitmentForm } from '@/components/recruitment-form';
import { LightboxProvider } from '@/contexts/lightbox-context';
import { DialogProvider } from '@/contexts/dialog-context';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Heart, ShieldCheck, Sparkles, Star, Users, Zap, XCircle, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dataStore } from '@/lib/data-store';

export default function RecruitmentPage() {
  const [isRecruitmentEnabled, setIsRecruitmentEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    document.title = 'Tuyển dụng | Katrina Coffee';
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await dataStore.getAppSettings();
      setIsRecruitmentEnabled(settings.isRecruitmentEnabled !== false);
    } catch (error) {
      console.error('Error loading recruitment settings:', error);
      setIsRecruitmentEnabled(true);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900 font-sans selection:bg-primary/10">
      {/* Abstract Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      <DialogProvider>
        <LightboxProvider>
          {/* Header/Navigation */}
          <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 transition-all">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                  <span className="text-white font-black text-sm">K</span>
                </div>
                <span className="font-bold text-slate-900 tracking-tight">Katrina Coffee</span>
              </div>
              <div className="hidden md:flex items-center gap-8 text-[13px] font-bold text-slate-500 uppercase tracking-wider">
                <a href="#" className="hover:text-primary transition-colors">Về chúng tôi</a>
                <a href="#" className="hover:text-primary transition-colors">Menu</a>
                <a href="#" className="hover:text-primary transition-colors">Cửa hàng</a>
                <div className="h-4 w-px bg-slate-200" />
                <span className="text-primary font-black">Tuyển dụng</span>
              </div>
            </div>
          </nav>

          <main className="relative z-10 min-h-[60vh] flex flex-col">
            {isRecruitmentEnabled === null ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
                </div>
              </div>
            ) : isRecruitmentEnabled ? (
              <>
                {/* Hero Section */}
                <section className="pt-16 pb-12 md:pt-24 md:pb-20 overflow-hidden">
                  <div className="container mx-auto px-6">
                    <motion.div 
                      initial="hidden"
                      animate="visible"
                      variants={containerVariants}
                      className="max-w-4xl mx-auto text-center"
                    >
                      <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Chúng mình đang tìm kiếm bạn</span>
                      </motion.div>
                      
                      <motion.h1 
                        variants={itemVariants}
                        className="text-4xl md:text-7xl font-black text-slate-900 leading-[1.05] mb-8 tracking-tighter"
                      >
                        Gia nhập đội ngũ <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500 drop-shadow-sm">Katrina Coffee</span>
                      </motion.h1>
                      
                      <motion.p 
                        variants={itemVariants}
                        className="text-lg md:text-xl text-slate-600 mb-12 max-w-2xl mx-auto leading-relaxed font-medium"
                      >
                        Môi trường làm việc thân thiện, chuyên nghiệp và luôn chào đón những người bạn mới cùng đồng hành.
                      </motion.p>

                      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-slate-500">
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm ring-1 ring-slate-200/50">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>Lương thưởng hấp dẫn</span>
                        </div>
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm ring-1 ring-slate-200/50">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span>Môi trường trẻ trung</span>
                        </div>
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm ring-1 ring-slate-200/50">
                          <Zap className="w-4 h-4 text-yellow-500" />
                          <span>Giờ làm linh hoạt</span>
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>
                </section>

                {/* Why Join Us Section */}
                <section className="py-24 bg-white relative">
                  <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                      <div className="group p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-2">
                        <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all">
                          <Users className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-black mb-4 text-slate-900 tracking-tight">Môi trường hoà đồng</h3>
                        <p className="text-slate-500 leading-relaxed font-medium">
                          Chúng mình coi trọng từng thành viên và luôn hỗ trợ nhau để cùng phát triển mỗi ngày trong một đại gia đình.
                        </p>
                      </div>

                      <div className="group p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-2">
                        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-8 group-hover:scale-110 group-hover:-rotate-3 transition-all">
                          <Zap className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-black mb-4 text-slate-900 tracking-tight">Lương & Thưởng</h3>
                        <p className="text-slate-500 leading-relaxed font-medium">
                          Mức lương cạnh tranh, xét tăng lương theo từng tháng dựa trên trách nhiệm với công việc.
                        </p>
                      </div>

                      <div className="group p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-green-200 hover:bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-2">
                        <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all">
                          <ShieldCheck className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-black mb-4 text-slate-900 tracking-tight">Giờ giấc linh hoạt</h3>
                        <p className="text-slate-500 leading-relaxed font-medium">
                          Dễ dàng đăng ký ca làm phù hợp với lịch học và lịch cá nhân, hỗ trợ tối đa cho các bạn sinh viên.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Application Form Section */}
                <section className="py-24 relative overflow-hidden">
                  {/* Artistic Background decoration */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -z-10" />
                  
                  <div className="container mx-auto px-3 sm:px-6">
                    <div className="max-w-6xl mx-auto">
                      <div className="mb-16 text-center px-4">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Sẵn sàng bắt đầu?</h2>
                        <p className="text-slate-500 font-medium text-lg">Hãy dành 2 phút để hoàn thiện hồ sơ ứng tuyển của bạn.</p>
                      </div>

                      <div className="relative">
                        <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-tr from-primary/10 to-indigo-500/10 rounded-[2rem] sm:rounded-[3rem] blur-2xl -z-10 opacity-50" />
                        <div className="relative">
                          <RecruitmentForm />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Recruitment Process */}
                <section className="py-24 bg-[#0f172a] text-white relative">
                  <div className="container mx-auto px-6">
                    <div className="max-w-5xl mx-auto">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-20">
                        <div>
                          <h2 className="text-4xl font-black mb-6 tracking-tight">Quy trình Tuyển dụng</h2>
                          <p className="text-slate-400 max-w-md font-medium text-lg leading-relaxed">
                            Chúng mình tinh gọn quy trình để bạn có thể bắt đầu công việc nhanh nhất có thể.
                          </p>
                        </div>
                        <div className="hidden md:flex items-center justify-center w-20 h-20 bg-white/5 rounded-full border border-white/10">
                          <ArrowRight className="w-8 h-8 text-primary" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                          { step: "01", title: "Nộp hồ sơ", desc: "Điền thông tin trực tuyến ngay trên trang này." },
                          { step: "02", title: "Phỏng vấn", desc: "Gặp mặt trực tiếp tại cửa hàng để cùng trao đổi." },
                          { step: "03", title: "Thử việc", desc: "Làm quen với môi trường và đồng đội trong 1-3 ngày." },
                          { step: "04", title: "Chính thức", desc: "Ký kết hợp đồng và trở thành một phần của Katrina!" }
                        ].map((item, i) => (
                          <div key={i} className="group relative p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/[0.08] transition-all hover:border-white/20">
                            <span className="text-6xl font-black text-primary/20 absolute top-6 right-6 group-hover:scale-110 transition-transform">{item.step}</span>
                            <h4 className="text-2xl font-black mb-3 relative z-10 tracking-tight">{item.title}</h4>
                            <p className="text-slate-400 leading-relaxed relative z-10 font-medium">{item.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-20 px-6">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-2xl w-full bg-white rounded-[3rem] p-12 text-center shadow-2xl shadow-slate-200 border border-slate-100 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-primary" />
                  <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-8 shadow-inner">
                    <AlertCircle className="w-12 h-12" />
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">Cửa hàng tạm ngưng nhận hồ sơ</h2>
                  <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed mb-10">
                    Hiện tại Katrina Coffee đã nhận đủ nhân sự và tạm dừng chương trình tuyển dụng. <br className="hidden md:block" />
                    Hẹn gặp bạn vào đợt tuyển dụng tiếp theo nhé!
                  </p>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                    <a 
                      href="https://www.facebook.com/KatrinaCoffeeVietNam/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full md:w-auto px-8 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                    >
                      Theo dõi chúng mình
                      <ArrowRight className="w-5 h-5" />
                    </a>
                  </div>
                </motion.div>
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-100 pt-20 pb-12 relative overflow-hidden">
            <div className="container mx-auto px-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-10 mb-16">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30">
                    <span className="text-white font-black text-2xl">K</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 tracking-tight text-xl">Katrina Coffee</h4>
                    <p className="text-sm text-slate-400 font-medium">Danang City, Vietnam</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100 w-full mb-10" />
              
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <p>© {new Date().getFullYear()} Katrina Coffee. Design for internal use.</p>
              </div>
            </div>
          </footer>
        </LightboxProvider>
      </DialogProvider>
    </div>
  );
}
