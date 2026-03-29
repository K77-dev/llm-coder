interface ScopeBadgeProps {
  scope: 'local' | 'global';
}

export function ScopeBadge({ scope }: ScopeBadgeProps) {
  const isLocal = scope === 'local';
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
        isLocal
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      }`}
      data-testid={`badge-${scope}`}
    >
      {isLocal ? 'local' : 'global'}
    </span>
  );
}
