export const API_URL = import.meta.env.VITE_API_URL;

export type DashboardUser = {
  id: number;
  name: string;
  email?: string;
  profileImage?: string;
  role: string;
};

export type StatusMessage = { type: 'success' | 'error'; text: string } | null;

/** What every tab receives from the Dashboard shell */
export interface TabProps {
  token: string;
  user: DashboardUser;
  setStatusMessage: (message: StatusMessage) => void;
  openConfirm: (title: string, message: string, onConfirm: () => void, danger?: boolean) => void;
  closeConfirm: () => void;
}

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// Items per page
export const ITEMS_PER_PAGE = {
  myProjects: 5,
  projects: 5,
  categories: 10,
  reviews: 3,
  users: 5,
  incidents: 5,
  userProjects: 5
};

export const paginate = <T,>(items: T[], page: number, itemsPerPage: number): T[] => {
  const startIndex = (page - 1) * itemsPerPage;
  return items.slice(startIndex, startIndex + itemsPerPage);
};

export const getTotalPages = (totalItems: number, itemsPerPage: number) => Math.ceil(totalItems / itemsPerPage);

  // Generate page numbers to display
