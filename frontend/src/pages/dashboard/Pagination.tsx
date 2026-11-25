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
      <div className="flex justify-center items-center gap-1 mt-4 flex-wrap">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-sm"
        >
          {t('dashboard.previous')}
        </button>
        
        {pageNumbers.map((page, index) => (
          typeof page === 'number' ? (
            <button
              key={index}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1 rounded border text-sm min-w-[36px] ${
                currentPage === page
                  ? 'bg-brand text-black border-brand font-semibold'
                  : 'border-gray-300 hover:bg-gray-100'
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
          className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-sm"
        >
          {t('dashboard.next')}
        </button>
      </div>
    );
  };

export default PaginationControls;
