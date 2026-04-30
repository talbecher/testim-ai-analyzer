import { cn } from '@/lib/utils';

const sizeClass = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
} as const;

const sizePx = { sm: 32, md: 40, lg: 44 } as const;

export type AppLogoSize = keyof typeof sizeClass;

export interface AppLogoProps {
  size?: AppLogoSize;
  className?: string;
  /** Override default alt text */
  alt?: string;
}

/** Site / app mark — uses `public/app-logo.png`. */
export function AppLogo({ size = 'md', className, alt = 'Testim regression analyzer' }: AppLogoProps) {
  const px = sizePx[size];
  return (
    <img
      src="/app-logo.png"
      alt={alt}
      width={px}
      height={px}
      className={cn(
        'shrink-0 rounded-xl object-cover shadow-md ring-1 ring-border',
        sizeClass[size],
        className,
      )}
    />
  );
}
