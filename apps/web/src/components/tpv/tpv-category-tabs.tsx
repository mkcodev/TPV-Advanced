'use client';

import { Skeleton, Tabs, TabsList, TabsTrigger } from '@tpv/ui';

interface Category {
  id: string;
  name: string;
  displayOrder: number;
}

interface TpvCategoryTabsProps {
  categories: Category[];
  isLoading: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function TpvCategoryTabs({
  categories,
  isLoading,
  activeId,
  onSelect,
}: TpvCategoryTabsProps) {
  if (isLoading) {
    return (
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
        {(['cat-sk-1', 'cat-sk-2', 'cat-sk-3', 'cat-sk-4'] as const).map((k) => (
          <Skeleton key={k} className="h-7 w-20 rounded-md" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) return null;

  const selected = activeId ?? categories[0]?.id ?? '';

  return (
    <Tabs value={selected} onValueChange={onSelect} className="shrink-0">
      <TabsList className="h-11 w-full justify-start rounded-none border-b border-border bg-transparent px-4">
        {categories.map((cat) => (
          <TabsTrigger
            key={cat.id}
            value={cat.id}
            className="min-h-[44px] rounded-md px-3 text-sm data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
          >
            {cat.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
