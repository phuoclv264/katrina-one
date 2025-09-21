import { NextResponse } from 'next/server';
import fetch from 'node-fetch';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image. Status: ${response.status}`);
    }

    const imageBuffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const dataUri = `data:${contentType};base64,${imageBuffer.toString('base64')}`;

    return NextResponse.json({ dataUri });
  } catch (error: any) {
    console.error('[IMAGE PROXY] Error:', error);
    return NextResponse.json({ error: 'Failed to proxy image', details: error.message }, { status: 500 });
  }
}
