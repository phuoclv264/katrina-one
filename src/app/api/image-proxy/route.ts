import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image. Status: ${response.status} ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const dataUri = `data:${contentType};base64,${base64Image}`;

    return NextResponse.json({ dataUri });
  } catch (error: any) {
    console.error('[IMAGE PROXY] Error:', error.message);
    return NextResponse.json({ error: 'Failed to proxy image', details: error.message }, { status: 500 });
  }
}
