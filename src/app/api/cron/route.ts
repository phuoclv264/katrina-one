'use server';

import { expirePassRequests } from '@/ai/flows/expire-pass-requests-flow';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Add security check to ensure only authorized services can run this job
  // For example, check for a 'X-Appengine-Cron' header for Google App Engine cron jobs
  // Or check for a secret token in the query parameters or headers
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await expirePassRequests();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error running expirePassRequests flow:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
