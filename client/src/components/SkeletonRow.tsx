import React from 'react';

export const SkeletonRow: React.FC = () => {
  return (
    <div className="space-y-3">
      {/* Skeleton header */}
      <div className="flex items-center justify-between px-1">
        <div className="h-5 w-40 rounded-md skeleton-shimmer" />
        <div className="h-4 w-16 rounded-md skeleton-shimmer" />
      </div>

      {/* Skeleton cards */}
      <div className="flex gap-3.5 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-32 sm:w-38 md:w-44 space-y-2">
            <div className="aspect-[2/3] w-full rounded-xl skeleton-shimmer" />
            <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
};
export default SkeletonRow;
