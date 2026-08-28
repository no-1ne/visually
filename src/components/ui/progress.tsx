import type * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentProps<'div'> {
  value?: number;
}

export function Progress({ value = 0, className, ...props }: ProgressProps) {
  const progress = Math.min(100, Math.max(0, value));
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-primary/10', className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full rounded-full bg-[#7657ff] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
