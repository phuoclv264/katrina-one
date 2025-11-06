'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

type ListCardProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  link: string;
  linkText: string;
};

export function ListCard({ title, icon, children, link, linkText }: ListCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
      <Card className="flex flex-col h-full">
        <CardHeader><CardTitle className="flex items-center gap-3 text-lg">{icon}{title}</CardTitle></CardHeader>
        <CardContent className="flex-grow space-y-3">{children}</CardContent>
        <CardFooter><Button asChild variant="outline" className="w-full"><Link href={link}>{linkText}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardFooter>
      </Card>
    </motion.div>
  );
}