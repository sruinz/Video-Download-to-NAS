import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pagination from './Pagination';

/**
 * 무한 스크롤(점진적 로드)과 페이지네이션을 통합 지원하는 탐색 컨테이너
 */
export default function FileBrowseContainer({
  items = [],
  browseMode = 'infinite',
  pageSize = 24,
  resetKey = '',
  children
}) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const containerTopRef = useRef(null);
  const sentinelRef = useRef(null);

  const safePageSize = Math.max(1, Number(pageSize) || 24);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));

  // 필터/정렬/폴더/모드/페이지크기 변경 시 1페이지 및 초기 개수로 초기화
  useEffect(() => {
    setCurrentPage(1);
    setVisibleCount(safePageSize);
  }, [resetKey, browseMode, safePageSize]);

  // 항목 삭제 등으로 전체 페이지 수가 줄어들면 현재 페이지 보정
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // 무한 스크롤 IntersectionObserver
  useEffect(() => {
    if (browseMode !== 'infinite') return;
    if (visibleCount >= totalItems) return;

    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + safePageSize, totalItems));
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [browseMode, visibleCount, totalItems, safePageSize]);

  const visibleItems = useMemo(() => {
    if (browseMode === 'pagination') {
      const start = (currentPage - 1) * safePageSize;
      return items.slice(start, start + safePageSize);
    }
    return items.slice(0, visibleCount);
  }, [items, browseMode, currentPage, safePageSize, visibleCount]);

  const handlePageChange = (nextPage) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    setCurrentPage(clamped);
    containerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScrollToTop = () => {
    containerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const endIndex = Math.min(currentPage * safePageSize, totalItems);
  const remainingCount = Math.max(0, totalItems - visibleItems.length);

  return (
    <div ref={containerTopRef} className="w-full min-w-0">
      {children(visibleItems)}

      {/* 페이지네이션 컨트롤 */}
      {browseMode === 'pagination' && totalItems > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="text-xs text-gray-400">
            {t('browse.pageRange', { start: startIndex, end: endIndex, total: totalItems })}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* 무한 스크롤 센티넬 + 수동 더보기 / 맨 위로 */}
      {browseMode === 'infinite' && totalItems > 0 && (
        <div className="mt-6 flex flex-col items-center gap-3">
          {remainingCount > 0 && (
            <>
              <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + safePageSize, totalItems))}
                className="inline-flex items-center gap-2 px-4 py-2 bg-yt-dark hover:bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                <span>
                  {t('browse.loadMore', {
                    shown: visibleItems.length,
                    total: totalItems
                  })}
                </span>
              </button>
            </>
          )}

          {visibleItems.length > safePageSize && (
            <button
              type="button"
              onClick={handleScrollToTop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-yt-dark hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>{t('browse.backToTop')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
