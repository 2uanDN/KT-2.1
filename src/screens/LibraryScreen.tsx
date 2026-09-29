import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '../components/shell/TopBar';
import { FilterBar } from '../components/filter/FilterBar';
import { SortBar } from '../components/filter/SortBar';
import { SortSheet } from '../components/filter/SortSheet';
import { ItemCard } from '../components/list/ItemCard';
import { GroupHeading } from '../components/list/GroupHeading';
import { InboxCountLine } from '../components/list/InboxCountLine';
import { EmptyState } from '../components/list/EmptyState';
import { LoadMoreButton } from '../components/list/LoadMoreButton';
import { PWAInstallButton } from '../components/shell/PWAInstallButton';
import { useLibraryStore } from '../store/libraryStore';
import { usePaginatedItems } from '../hooks/usePaginatedItems';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import { useInboxCount, useSavedCount } from '../hooks/useLiveCount';
import { useBatchTags } from '../hooks/useBatchTags';
import { db } from '../db/database';
import type { Item } from '../types/item';

export const LibraryScreen: React.FC = () => {
  const navigate = useNavigate();
  const listRef = useScrollPreservation('library');
  const [showSortSheet, setShowSortSheet] = useState(false);

  const {
    activeTypeFilter,
    activeTagFilter,
    sortMode,
  } = useLibraryStore();

  const inboxCount = useInboxCount();
  const totalSavedCount = useSavedCount();

  // Query saved items with database-level indexed filtering:
  // - If tag filter is active, leverage Dexie multi-entry index `*tags`
  // - If type is note/file/link, leverage compound index `[status+type]`
  // - If type is pinned, query saved status and filter pinned items
  // - Otherwise, query saved status
  const filteredItems = useLiveQuery(
    async () => {
      // 1. Tag filter (uses Dexie multi-entry index `*tags`)
      if (activeTagFilter) {
        return db.items
          .where('tags')
          .equals(activeTagFilter)
          .filter((item) => {
            if (item.status !== 'saved') return false;
            if (activeTypeFilter === 'pinned') return Boolean(item.isPinned);
            if (activeTypeFilter !== 'all') return item.type === activeTypeFilter;
            return true;
          })
          .toArray();
      }

      // 2. Type filter (uses compound index `[status+type]`)
      if (activeTypeFilter === 'note' || activeTypeFilter === 'file' || activeTypeFilter === 'link') {
        return db.items.where('[status+type]').equals(['saved', activeTypeFilter]).toArray();
      }

      // 3. Pinned filter
      if (activeTypeFilter === 'pinned') {
        return db.items
          .where('status')
          .equals('saved')
          .filter((item) => Boolean(item.isPinned))
          .toArray();
      }

      // 4. Default: All saved items
      return db.items.where('status').equals('saved').toArray();
    },
    [activeTypeFilter, activeTagFilter]
  ) || [];

  // Sort comparator
  const sortFn = useMemo(() => {
    return (a: Item, b: Item) => {
      if (sortMode === 'title') {
        return a.title.localeCompare(b.title, 'vi');
      }
      if (sortMode === 'lastOpenedAt') {
        const timeA = a.lastOpenedAt || 0;
        const timeB = b.lastOpenedAt || 0;
        return timeB - timeA;
      }
      // default: savedAt
      const timeA = a.savedAt || a.createdAt;
      const timeB = b.savedAt || b.createdAt;
      return timeB - timeA;
    };
  }, [sortMode]);

  // Separate pinned items from unpinned items so pinned items are ALWAYS at the top
  const { pinnedItems, unpinnedItems } = useMemo(() => {
    if (activeTypeFilter === 'pinned') {
      // In 'pinned' tab, all items are already pinned; display them in the main regular list
      const sorted = [...filteredItems].sort(sortFn);
      return { pinnedItems: [], unpinnedItems: sorted };
    }

    const pinned: Item[] = [];
    const unpinned: Item[] = [];
    for (const item of filteredItems) {
      if (item.isPinned) {
        pinned.push(item);
      } else {
        unpinned.push(item);
      }
    }
    pinned.sort(sortFn);
    unpinned.sort(sortFn);

    return { pinnedItems: pinned, unpinnedItems: unpinned };
  }, [filteredItems, sortFn, activeTypeFilter]);

  // Paginated list for unpinned items (10 items/page) - resets automatically when filter or sort changes
  const filterResetKey = `${activeTypeFilter}:${activeTagFilter || ''}:${sortMode}`;
  const {
    items: displayRegularItems,
    hasMore,
    loadMore,
    visibleCount: regularVisibleCount,
  } = usePaginatedItems<Item>(unpinnedItems, filterResetKey);

  // All currently visible items (both pinned and unpinned) for batch loading tags
  const visibleItems = useMemo(
    () => [...pinnedItems, ...displayRegularItems],
    [pinnedItems, displayRegularItems]
  );

  // Batch-load tags for all visible items only (solves N+1 query pattern)
  const tagMap = useBatchTags(visibleItems);

  const totalItemsCount = filteredItems.length;
  const currentVisibleCount = pinnedItems.length + regularVisibleCount;

  const hasActiveFilter = activeTypeFilter !== 'all' || activeTagFilter !== null;

  return (
    <div className="flex-1 flex flex-col bg-[#FFFFFF]" ref={listRef}>
      {/* TopBar with PWA install button, settings button, and search button */}
      <TopBar
        variant="list"
        title="Thư viện"
        onSearchClick={() => navigate('/search')}
        rightAction={
          <div className="flex items-center gap-1">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label="Cài đặt & Sao lưu"
              title="Cài đặt & Sao lưu"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1.5 text-[#3D4A5C] hover:text-[#1B1B1B] hover:bg-[#E8E8E8] rounded-md transition cursor-pointer press-xs"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </button>
          </div>
        }
      />

      {/* Filter Bar with Type & Tag chips and 32px overlay */}
      <FilterBar />

      {/* Separate Sort Bar section */}
      <SortBar onOpenSort={() => setShowSortSheet(true)} />

      <div className="p-4 flex-1">
        {/* Inbox count banner */}
        <InboxCountLine />

        {/* Empty States */}
        {totalSavedCount === 0 && !hasActiveFilter && (
          <EmptyState
            title="Chưa có mục nào được giữ lâu dài"
            subtitle="Các mục trong thư viện là những tri thức quan trọng được lưu giữ vĩnh viễn."
            icon="auto_stories"
            action={
              inboxCount > 0
                ? { label: 'Xem Hộp chờ', to: '/inbox' }
                : { label: 'Tạo tri thức đầu tiên', to: '/save' }
            }
          />
        )}

        {totalSavedCount > 0 && totalItemsCount === 0 && hasActiveFilter && (
          <EmptyState
            title="Không có mục nào khớp"
            subtitle="Hãy thử thay đổi các bộ lọc hiện tại."
            icon="filter_alt_off"
          />
        )}

        {/* Items List */}
        {visibleItems.length > 0 && (
          <div className="space-y-4">
            {/* Pinned Group */}
            {pinnedItems.length > 0 && (
              <section className="space-y-2.5">
                <GroupHeading
                  title="ĐÃ GHIM"
                  icon="push_pin"
                  count={pinnedItems.length}
                />
                <div className="grid grid-cols-1 gap-3">
                  {pinnedItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      tagMap={tagMap}
                      onOpen={(id) => navigate(`/items/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Regular Saved Group */}
            {displayRegularItems.length > 0 && (
              <section className="space-y-2.5">
                {pinnedItems.length > 0 && (
                  <GroupHeading
                    title="ĐÃ GIỮ"
                    icon="bookmark"
                    count={unpinnedItems.length}
                  />
                )}
                <div className="grid grid-cols-1 gap-3">
                  {displayRegularItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      tagMap={tagMap}
                      onOpen={(id) => navigate(`/items/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Load more button */}
            <LoadMoreButton
              hasMore={hasMore}
              onLoadMore={loadMore}
              visibleCount={currentVisibleCount}
              totalCount={totalItemsCount}
            />
          </div>
        )}
      </div>

      <SortSheet
        isOpen={showSortSheet}
        onClose={() => setShowSortSheet(false)}
      />
    </div>
  );
};
