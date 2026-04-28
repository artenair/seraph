import { Badge } from '@/components/ui/badge';

const CAT_COLORS = ['', '#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const catColor = n => CAT_COLORS[n] ?? '#374151';

export function CatBadge({ n }) {
  return (
    <Badge style={{ background: catColor(n), color: '#fff', border: 'none' }}>
      CAT{n}
    </Badge>
  );
}
