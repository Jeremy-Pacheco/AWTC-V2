import React from "react";
import { useTranslation } from "react-i18next";

// Page numbers to display, with "..." gaps
function getPageNumbersImpl(currentPage: number, totalPages: number): (number | string)[] {
    const pages: (number | string)[] = [];
    const maxVisible = 5; // Max number of page buttons to show
    
    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
}

/**
 * Pagination buttons. Defined at module level: inside Dashboard it was a new
 * component type on every render, so React remounted it each time.
 */
const PaginationControls: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
  const { t } = useTranslation();
    if (totalPages <= 1) return null;

    const pageNumbers = getPageNumbersImpl(currentPage, totalPages);

    return (
      <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-full border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('dashboard.previous')}
        </button>
        
        {pageNumbers.map((page, index) => (
          typeof page === 'number' ? (
            <button
              key={index}
              onClick={() => onPageChange(page)}
              aria-current={currentPage === page ? 'page' : undefined}
              className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-brand text-on-brand font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          ) : (
            <span key={index} className="px-2 py-1 text-gray-500">
              {page}
            </span>
          )
        ))}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-full border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('dashboard.next')}
        </button>
      </div>
    );
  };

export default PaginationControls;
