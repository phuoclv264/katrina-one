"use client"

import React from "react"
import { ChevronRight, ClipboardList, User, Award, ArrowUpRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface TaskItemCardProps {
  name: string
  reportCount: number
  totalAssigned?: number
  onClick: () => void
}

export function TaskItemCard({ name, reportCount, totalAssigned, onClick }: TaskItemCardProps) {
  return (
    <Card 
      className="group relative overflow-hidden border-slate-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/50 hover:border-primary/40 transition-all cursor-pointer hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.98] rounded-[2.5rem]"
      onClick={onClick}
    >
      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-4 transition-all duration-300">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ArrowUpRight className="h-5 w-5 text-primary" />
        </div>
      </div>
      
      <div className="p-8 space-y-6">
        <div className="flex items-start gap-5">
          <div className="p-4 rounded-3xl bg-slate-50 dark:bg-zinc-800 text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/30 transition-all duration-500 scale-100 group-hover:scale-110">
            <ClipboardList className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-xl text-foreground group-hover:text-primary transition-colors leading-tight mb-2">
              {name}
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/10">
                <span className="text-[11px] font-black text-primary uppercase tracking-wider">{reportCount} báo cáo</span>
              </div>
              {totalAssigned !== undefined && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-zinc-800 border border-slate-200/50 dark:border-zinc-700/50">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{totalAssigned} nhân viên</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative element */}
      <div className="absolute -bottom-12 -right-12 h-32 w-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
    </Card>
  )
}

interface StaffItemCardProps {
  userName: string
  rank: number
  reportCount: number
  onClick: () => void
}

export function StaffItemCard({ userName, rank, reportCount, onClick }: StaffItemCardProps) {
  const isTopRank = rank <= 3
  const rankColors = {
    1: "from-amber-400 to-yellow-600 shadow-amber-200",
    2: "from-slate-300 to-slate-500 shadow-slate-200",
    3: "from-orange-300 to-orange-600 shadow-orange-200",
  }[rank] || "from-primary/20 to-primary/40 shadow-primary/10"

  return (
    <Card 
      className="group relative overflow-hidden border-slate-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/50 hover:border-primary/40 transition-all cursor-pointer hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.98] rounded-[2.5rem]"
      onClick={onClick}
    >
      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-4 transition-all duration-300">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ArrowUpRight className="h-5 w-5 text-primary" />
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <div className={`h-16 w-16 rounded-[1.75rem] bg-gradient-to-br ${rankColors} flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
              {isTopRank ? (
                <Award className="h-8 w-8 text-white" />
              ) : (
                <span className="text-xl font-black text-primary">#{rank}</span>
              )}
            </div>
            {isTopRank && (
              <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white dark:bg-zinc-800 shadow-md border-2 border-amber-500 flex items-center justify-center">
                <span className="text-[10px] font-black text-amber-600">{rank}</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-xl text-foreground group-hover:text-primary transition-colors leading-tight mb-3">
              {userName}
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">Hiệu suất tháng</span>
                <span className="text-sm font-black text-primary">{reportCount} báo cáo</span>
              </div>
              <div className="relative h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full bg-gradient-to-r ${isTopRank ? "from-amber-400 to-amber-600" : "from-primary to-primary-foreground"} transition-all duration-1000 ease-out group-hover:brightness-110`}
                  style={{ width: `${Math.min(reportCount * 4, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative background glow */}
      <div className={`absolute -bottom-24 -left-24 h-48 w-48 rounded-full blur-[80px] opacity-20 transition-opacity group-hover:opacity-40 bg-gradient-to-br ${rankColors}`} />
    </Card>
  )
}
