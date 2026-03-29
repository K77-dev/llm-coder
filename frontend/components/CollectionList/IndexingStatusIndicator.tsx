import { IndexingStatus } from '../../lib/api';

interface IndexingStatusIndicatorProps {
  status?: IndexingStatus;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  indexing: { color: 'bg-blue-400', label: 'Indexing' },
  done: { color: 'bg-green-400', label: 'Indexed' },
  error: { color: 'bg-red-400', label: 'Error' },
};

export function IndexingStatusIndicator({ status }: IndexingStatusIndicatorProps) {
  if (!status || status === 'idle') return null;
  const { color, label } = STATUS_CONFIG[status] ?? { color: 'bg-gray-400', label: status };
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${color} shrink-0`}
      title={label}
      aria-label={`Indexing status: ${label}`}
      data-testid={`status-${status}`}
    />
  );
}
