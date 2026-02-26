'use client';

import { RecruitmentForm } from '@/components/recruitment-form';
import { LightboxProvider } from '@/contexts/lightbox-context';
import { DialogProvider } from '@/contexts/dialog-context';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Heart, ShieldCheck, Sparkles, Star, Users, Zap, XCircle, AlertCircle, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';
import { dataStore } from '@/lib/data-store';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';

export default function RecruitmentPage() {
  const [isRecruitmentEnabled, setIsRecruitmentEnabled] = useState<boolean | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();

    const intervalId = setInterval(() => {
      if (emblaApi) emblaApi.scrollNext();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const features = [
    {
      icon: <Users className="w-8 h-8" />,
      title: "Môi trường hoà đồng",
      desc: "Chúng mình coi trọng từng thành viên, luôn hỗ trợ nhau và cùng phát triển trong một tập thể chuyên nghiệp nhưng đầy sự thân thiện.",
      color: "blue",
      bgClass: "bg-blue-50",
      textClass: "text-blue-600",
      accentClass: "from-blue-600/10 to-transparent"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Thu nhập rõ ràng & minh bạch",
      desc: "Pha chế Part-time: 20–24k/giờ (tuỳ năng lực). Pha chế Full-time: 25–30k/giờ. Phục vụ: 18–24k/giờ (tuỳ năng lực). Xét tăng lương định kỳ dựa trên trách nhiệm và thái độ làm việc.",
      color: "indigo",
      bgClass: "bg-indigo-50",
      textClass: "text-indigo-600",
      accentClass: "from-indigo-600/10 to-transparent"
    },
    {
      icon: <ShieldCheck className="w-8 h-8" />,
      title: "Giờ giấc linh hoạt",
      desc: "Đăng ký ca làm phù hợp với lịch học và lịch cá nhân. Ưu tiên sinh viên nhưng vẫn đảm bảo tính chuyên nghiệp và kỷ luật.",
      color: "emerald",
      bgClass: "bg-emerald-50",
      textClass: "text-emerald-600",
      accentClass: "from-emerald-600/10 to-transparent"
    }
  ];

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
          <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 transition-all">
            <div className="container mx-auto px-6 h-20 flex items-center justify-between">
              <div className="flex items-center gap-3 group cursor-pointer">
                <div className="w-10 h-10 relative rounded-xl flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform duration-300">
                  <Image
                    src="/KATRINA_avt_01.png"
                    alt="Katrina Coffee logo"
                    fill
                    className="object-contain rounded-xl"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 tracking-tight leading-none text-lg">Katrina Coffee</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Xin chào</span>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-4">
                <div className="h-8 w-px bg-slate-200 mx-2" />
                <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em] px-4 py-2 bg-primary/5 rounded-full ring-1 ring-primary/20">
                  Tuyển dụng 2026
                </span>
              </div>
            </div>
          </nav>

          <main className="relative z-10 min-h-[60vh] flex flex-col">
            {isRecruitmentEnabled === null ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Hệ thống đang sẵn sàng</p>
                </div>
              </div>
            ) : isRecruitmentEnabled ? (
              <>
                {/* Hero Section */}
                <section className="pt-20 pb-16 md:pt-32 md:pb-28 relative overflow-hidden">
                  {/* Decorative blobs for Hero */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
                    <div className="absolute top-[10%] left-[10%] w-[30%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[30%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
                  </div>

                  <div className="container mx-auto px-6">
                    <motion.div 
                      initial="hidden"
                      animate="visible"
                      variants={containerVariants}
                      className="max-w-5xl mx-auto text-center"
                    >
                      <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] mb-8 shadow-xl shadow-slate-200">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Hiring Now</span>
                        <div className="w-1 h-1 rounded-full bg-white/30" />
                        <span className="text-white/60">Khám phá cơ hội mới</span>
                      </motion.div>
                      
                      <motion.h1 
                        variants={itemVariants}
                        className="text-5xl md:text-8xl font-black text-slate-900 leading-[1.1] mb-10 tracking-tighter"
                      >
                        Viết tiếp câu chuyện <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-blue-600 to-indigo-600 drop-shadow-sm">cùng Katrina 2026</span>
                      </motion.h1>
                      
                      <motion.p 
                        variants={itemVariants}
                        className="text-lg md:text-2xl text-slate-500 mb-14 max-w-3xl mx-auto leading-relaxed font-medium"
                      >
                        Môi trường làm việc thân thiện, chuyên nghiệp và luôn chào đón những người bạn mới cùng đồng hành.
                      </motion.p>

                      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-black">
                        {[
                          { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, text: "THU NHẬP CẠNH TRANH", color: "text-emerald-600 bg-emerald-50 ring-emerald-100" },
                          { icon: <Users className="w-4 h-4 text-blue-500" />, text: "MÔI TRƯỜNG THÂN THIỆN", color: "text-blue-600 bg-blue-50 ring-blue-100" },
                          { icon: <Zap className="w-4 h-4 text-amber-500" />, text: "LỊCH LÀM LINH HOẠT", color: "text-amber-600 bg-amber-50 ring-amber-100" }
                        ].map((badge, idx) => (
                          <div key={idx} className={cn("flex items-center gap-2.5 px-6 py-3.5 rounded-2xl border border-transparent shadow-sm ring-1 transition-all hover:scale-105 uppercase tracking-wider", badge.color)}>
                            {badge.icon}
                            <span>{badge.text}</span>
                        </div>
                        ))}
                      </motion.div>
                    </motion.div>
                  </div>
                </section>

                {/* Why Join Us Slider Section */}
                <section className="py-28 bg-[#f8fafc] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white rounded-full blur-[120px] -z-10 opacity-80" />
                  <div className="absolute -bottom-[10%] -left-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10" />
                  
                  <div className="container mx-auto px-6">
                    <div className="max-w-xl mx-auto text-center mb-16">
                      <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Giá trị cốt lõi</h2>
                      <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">Vì sao bạn nên chọn <br /> Katrina Coffee?</h3>
                    </div>

                    <div className="max-w-5xl mx-auto">
                      <div className="relative group">
                        <div className="overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
                          <div className="flex items-stretch">
                            {features.map((feature, index) => (
                              <div key={index} className="flex-[0_0_100%] min-w-0 px-4 md:px-8 py-2">
                                <motion.div 
                                  initial={{ opacity: 0, y: 30 }}
                                  animate={selectedIndex === index ? { opacity: 1, y: 0 } : { opacity: 0.2, scale: 0.9, y: 20 }}
                                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                  className="relative group p-10 md:p-20 rounded-[4rem] bg-white border border-slate-100 flex flex-col items-center text-center overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.04)] h-full"
                                >
                                  {/* Decorative Accent */}
                                  <div className={cn(
                                    "absolute top-0 inset-x-0 h-3 bg-gradient-to-r opacity-40",
                                    feature.accentClass
                                  )} />
                                  
                                  <motion.div 
                                    initial={{ scale: 0.8 }}
                                    animate={selectedIndex === index ? { scale: 1, rotate: [0, 5, -5, 0] } : { scale: 0.8 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    className={cn(
                                      "w-24 h-24 rounded-[2rem] flex items-center justify-center mb-12 shadow-2xl ring-8 ring-white transition-all duration-500",
                                      feature.bgClass,
                                      feature.textClass,
                                      selectedIndex === index ? "shadow-primary/20 scale-110" : "grayscale opacity-50"
                                    )}
                                  >
                                    {feature.icon}
                                  </motion.div>
                                  
                                  <h3 className="text-3xl md:text-5xl font-black mb-8 text-slate-900 tracking-tight leading-tight">
                                    {feature.title}
                                  </h3>
                                  
                                  <p className="text-lg md:text-xl text-slate-500 leading-relaxed font-medium max-w-2xl px-4 flex-grow">
                                    {feature.desc}
                                  </p>

                                  <div className="mt-16 flex items-center gap-3">
                                    {features.map((_, i) => (
                                      <button
                                        key={i} 
                                        onClick={() => emblaApi?.scrollTo(i)}
                                        className={cn(
                                          "h-2 rounded-full transition-all duration-700",
                                          selectedIndex === i 
                                            ? "w-12 bg-primary shadow-lg shadow-primary/30" 
                                            : "w-2 bg-slate-200 hover:bg-slate-300"
                                        )}
                                        aria-label={`Go to slide ${i + 1}`}
                                      />
                                    ))}
                                  </div>
                                </motion.div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Navigation Buttons - More modern glassmorphism */}
                        <div className="absolute top-1/2 -translate-y-1/2 -left-4 md:-left-12 lg:-left-24 hidden sm:block">
                          <button 
                            onClick={scrollPrev}
                            className="bg-white/90 backdrop-blur-xl shadow-2xl shadow-slate-200/50 border border-slate-100 hover:bg-primary hover:text-white text-slate-400 p-6 rounded-3xl transition-all active:scale-90 group"
                          >
                            <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
                          </button>
                        </div>
                        
                        <div className="absolute top-1/2 -translate-y-1/2 -right-4 md:-right-12 lg:-right-24 hidden sm:block">
                          <button 
                            onClick={scrollNext}
                            className="bg-white/90 backdrop-blur-xl shadow-2xl shadow-slate-200/50 border border-slate-100 hover:bg-primary hover:text-white text-slate-400 p-6 rounded-3xl transition-all active:scale-90 group"
                          >
                            <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Application Form Section */}
                <section className="py-32 relative overflow-hidden bg-white">
                  {/* Background decoration */}
                  <div className="absolute top-[20%] left-[5%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] -z-10" />
                  <div className="absolute bottom-[20%] right-[5%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -z-10" />
                  
                  <div className="container mx-auto px-3 sm:px-6">
                    <div className="max-w-6xl mx-auto">
                      <div className="mb-20 text-center px-4">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          className="space-y-4"
                        >
                          <h2 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 tracking-tighter">
                            Sẵn sàng cho hành trình mới?
                          </h2>
                          <div className="h-1.5 w-24 bg-primary mx-auto rounded-full" />
                          <p className="text-slate-500 font-medium text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                            Mất chưa đầy 5 phút để hoàn thành hồ sơ. Chúng mình trân trọng mọi cơ hội được làm việc cùng bạn.
                          </p>
                        </motion.div>
                      </div>

                      <div className="relative group">
                        <div className="absolute -inset-4 md:-inset-8 bg-gradient-to-tr from-primary/20 via-blue-500/10 to-transparent rounded-[3rem] md:rounded-[5rem] blur-3xl -z-10 opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
                        <div className="relative">
                          <RecruitmentForm />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Recruitment Process */}
                <section className="py-32 bg-[#020617] text-white relative overflow-hidden">
                  {/* Dark mode accents */}
                  <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-0" />
                  <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] -z-0" />

                  <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-6xl mx-auto">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-24">
                        <div className="max-w-xl">
                          <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-6">Execution</h2>
                          <h3 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter leading-tight">Quy trình <br /> tiếp nhận hồ sơ</h3>
                          <p className="text-slate-400 font-medium text-lg leading-relaxed">
                            Katrina tối ưu quy trình để đảm bảo sự minh bạch và tiết kiệm thời gian cho các ứng viên tiềm năng.
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex -space-x-4">
                            {[1,2,3,4].map(i => (
                              <div key={i} className="w-12 h-12 rounded-full border-4 border-[#020617] bg-slate-800 flex items-center justify-center text-[10px] font-black">{i}</div>
                            ))}
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:block">4 Bước tinh gọn</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8">
                        {[
                          {
                            step: "01",
                            title: "Nộp hồ sơ online",
                            icon: <Upload className="w-5 h-5" />,
                            desc: "Điền đầy đủ thông tin ứng tuyển trực tiếp trên website."
                          },
                          {
                            step: "02",
                            title: "Liên hệ & phỏng vấn",
                            icon: <Users className="w-5 h-5" />,
                            desc: "Chúng mình sẽ liên hệ để hẹn lịch phỏng vấn tại cửa hàng."
                          },
                          {
                            step: "03",
                            title: "Thử việc",
                            icon: <Zap className="w-5 h-5" />,
                            desc: "Làm quen môi trường và đánh giá năng lực trong khoảng 1 tuần, trong đó có 1 ngày training không lương."
                          },
                          {
                            step: "04",
                            title: "Nhận việc chính thức",
                            icon: <CheckCircle2 className="w-5 h-5" />,
                            desc: "Xác nhận mức lương phù hợp năng lực và bắt đầu làm việc."
                          }
                        ].map((item, i) => (
                          <motion.div 
                            key={i} 
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className="group relative p-10 bg-white/[0.03] border border-white/10 rounded-[2.5rem] hover:bg-white/[0.06] transition-all duration-500 hover:border-primary/50"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-10 group-hover:bg-primary group-hover:text-white transition-all duration-500 text-slate-400">
                              {item.icon}
                          </div>
                            <span className="text-5xl font-black text-white/[0.03] absolute top-8 right-8 group-hover:text-primary/10 transition-colors duration-500">{item.step}</span>
                            <h4 className="text-2xl font-black mb-4 relative z-10 tracking-tight">{item.title}</h4>
                            <p className="text-slate-500 leading-relaxed relative z-10 font-medium text-sm group-hover:text-slate-300 transition-colors uppercase tracking-wide">{item.desc}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-32 px-6">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-3xl w-full bg-white rounded-[4rem] p-16 md:p-24 text-center shadow-2xl shadow-slate-200 border border-slate-100 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-amber-500 via-primary to-blue-500" />
                  
                  <div className="relative">
                    <div className="w-28 h-28 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-12 shadow-inner ring-8 ring-amber-50/50">
                      <AlertCircle className="w-14 h-14" />
                  </div>
                    
                    <h2 className="text-4xl md:text-6xl font-black text-slate-900 mb-8 tracking-tighter">
                      Cửa hàng <br className="md:hidden" /> tạm ngưng nhận hồ sơ
                    </h2>
                    
                    <p className="text-lg md:text-2xl text-slate-500 font-medium leading-relaxed mb-14 max-w-xl mx-auto">
                      Hiện tại Katrina Coffee đã tìm được những cộng sự phù hợp và tạm dừng chương trình tuyển dụng. <br className="hidden md:block" />
                      Hẹn sớm gặp bạn trong tương lai gần!
                  </p>
                    
                    <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    <a 
                      href="https://www.facebook.com/KatrinaCoffeeVietNam/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                        className="w-full md:w-auto px-10 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-3 font-black shadow-2xl shadow-slate-900/20 hover:bg-primary transition-all active:scale-95 group"
                    >
                        Theo dõi Fanpage
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                    </div>
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
