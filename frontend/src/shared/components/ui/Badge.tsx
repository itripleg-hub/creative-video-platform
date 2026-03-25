import { clsx } from 'clsx';
import type { JobStatus, StepStatus, TemplateStatus } from '@/shared/types';

type BadgeVariant = 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
};

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

const jobStatusVariant: Record<JobStatus, BadgeVariant> = {
  PENDING: 'yellow',
  PROCESSING: 'blue',
  COMPLETED: 'green',
  FAILED: 'red',
  CANCELLED: 'gray',
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={jobStatusVariant[status]}>{status}</Badge>;
}

const stepStatusVariant: Record<StepStatus, BadgeVariant> = {
  PENDING: 'gray',
  RUNNING: 'blue',
  COMPLETED: 'green',
  FAILED: 'red',
  SKIPPED: 'yellow',
};

export function StepStatusBadge({ status }: { status: StepStatus }) {
  return <Badge variant={stepStatusVariant[status]}>{status}</Badge>;
}

const templateStatusVariant: Record<TemplateStatus, BadgeVariant> = {
  DRAFT: 'yellow',
  ACTIVE: 'green',
  ARCHIVED: 'gray',
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  return <Badge variant={templateStatusVariant[status]}>{status}</Badge>;
}
