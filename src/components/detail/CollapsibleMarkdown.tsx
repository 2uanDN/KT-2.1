import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { MarkdownRenderer } from '../../markdown/MarkdownRenderer';

interface CollapsibleMarkdownProps {
  content: string;
  collapsedHeight?: number;
  className?: string;
}

const DEFAULT_COLLAPSED_HEIGHT = 280;

export const CollapsibleMarkdown: React.FC<CollapsibleMarkdownProps> = ({
  content,
  collapsedHeight = DEFAULT_COLLAPSED_HEIGHT,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Initial estimate based on character count and line breaks to prevent layout jumping
  const looksLongInitially = content.length > 350 || content.split('\n').length > 8;
  const [isOverflowing, setIsOverflowing] = useState(looksLongInitially);

  // Measure actual DOM height after render
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkOverflow = () => {
      // If expanded, scrollHeight is the full height, clientHeight may vary
      const contentHeight = el.scrollHeight;
      const exceeds = contentHeight > collapsedHeight + 35;
      setIsOverflowing(exceeds);
    };

    checkOverflow();

    // Use ResizeObserver for responsive resizing adjustments
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        checkOverflow();
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [content, collapsedHeight]);

  // Reset expanded state if the content changes completely (e.g. user selected another file)
  useEffect(() => {
    setIsExpanded(false);
  }, [content]);

  const shouldClamp = isOverflowing && !isExpanded;

  return (
    <div className={`collapsible-markdown-root ${className}`}>
      <div
        ref={containerRef}
        className={`relative transition-all duration-300 ${
          shouldClamp ? 'overflow-hidden' : 'overflow-visible'
        }`}
        style={{
          maxHeight: shouldClamp ? `${collapsedHeight}px` : 'none',
        }}
      >
        <MarkdownRenderer content={content} />

        {/* Soft gradient fade overlay when collapsed */}
        {shouldClamp && (
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/85 to-transparent pointer-events-none"
          />
        )}
      </div>

      {/* Expand / Collapse Button controls */}
      {isOverflowing && (
        <div className="pt-2">
          {!isExpanded ? (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="w-full py-2 px-3 rounded-lg border border-[#3D4A5C] bg-[#FAF9F7] hover:bg-[#FFFFFF] text-[#3D4A5C] hover:text-[#1B1B1B] text-xs font-mono font-bold shadow-hard-xs transition flex items-center justify-center gap-1.5 cursor-pointer press-xs"
              aria-label="Mở rộng để xem toàn bộ nội dung"
            >
              <span className="material-symbols-outlined text-[18px]">unfold_more</span>
              <span>MỞ RỘNG NỘI DUNG</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
              className="w-full py-1.5 px-3 rounded-lg border border-[#3D4A5C]/40 bg-[#FAF9F7] hover:bg-[#FFFFFF] text-[#75777D] hover:text-[#1B1B1B] text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer press-xs"
              aria-label="Thu gọn nội dung"
            >
              <span className="material-symbols-outlined text-[18px]">unfold_less</span>
              <span>THU GỌN</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
