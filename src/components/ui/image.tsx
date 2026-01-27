'use client';

import NextImage, { type ImageProps as NextImageProps } from 'next/image';

// Minimal drop-in wrapper that only provides default `fill` and `sizes`.
// Behavior otherwise matches `next/image` exactly.
export type { ImageProps } from 'next/image';

const DEFAULT_SIZES = '128px';

function Image(props: NextImageProps) {
  const { fill, sizes, width, height, ...rest } = props;

  // Default behavior requested: when no width/height are provided, default to `fill=true`.
  const isFill = (width || height) ? (fill ?? false) : (fill ?? true);
  const finalSizes = isFill ? (sizes ?? DEFAULT_SIZES) : sizes;

  return <NextImage {...rest} width={width} height={height} fill={isFill} sizes={finalSizes} loading="eager" />;
}

export default Image;
export { Image };
