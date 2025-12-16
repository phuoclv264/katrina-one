'use client';

import React from 'react';
import { TrendingDown, TrendingUp, Wallet, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface KPIMetric {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  color: 'green' | 'orange' | 'blue' | 'purple';
  bgColor: string;
  iconBgColor: string;
  iconColor: string;
}

interface KPIMetricsSectionProps {
  metrics: KPIMetric[];
}

const colorMap = {
  green: 'text-green-600 dark:text-green-400',
  orange: 'text-orange-600 dark:text-orange-400',
  blue: 'text-blue-600 dark:text-blue-400',
  purple: 'text-purple-600 dark:text-purple-400',
};

export function KPIMetricsSection({ metrics }: KPIMetricsSectionProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
      {metrics.map((metric, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className={`${metric.bgColor} rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className={`w-10 h-10 rounded-full ${metric.iconBgColor} flex items-center justify-center ${metric.iconColor}`}>
              {metric.icon}
            </div>
            {metric.trend !== undefined && (
              <span className={`flex items-center text-xs font-medium ${metric.trend >= 0 ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-green-500 bg-green-50 dark:bg-green-900/20'} px-2 py-1 rounded-full`}>
                {metric.trend >= 0 ? (
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                )}
                {Math.abs(metric.trend)}%
              </span>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{metric.label}</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metric.value}</h3>
          </div>
          {metric.trendLabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{metric.trendLabel}</p>
          )}
        </motion.div>
      ))}
    </section>
  );
}
