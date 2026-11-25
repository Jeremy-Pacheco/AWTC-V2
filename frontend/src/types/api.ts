/**
 * Shapes of the data returned by the backend API, as used by the frontend.
 * Optional fields may be missing or null depending on the endpoint.
 */

export type Role = 'volunteer' | 'coordinator' | 'admin';

export interface AppUser {
  id: number;
  name: string;
  email?: string;
  role: Role | string;
  profileImage?: string | null;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  capacity?: number | null;
  status?: string | null;
  filename?: string | null;
  categoryId?: number | null;
  /** Responsible coordinator; null = admins only */
  ownerId?: number | null;
  category?: Category | null;
  volunteerCount?: number;
}

/** A project in a user's list, flagged when the user is banned from it */
export interface UserProjectEntry extends Pick<Project, 'id' | 'name'>, Partial<Omit<Project, 'id' | 'name'>> {
  banned?: boolean;
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  subject?: string | null;
  message: string;
  read?: boolean;
  createdAt?: string;
}

export interface Review {
  id: number;
  content: string;
  date: string;
  image?: string | null;
  user?: { id?: number; name?: string; email?: string } | null;
}

/** Project form values: "" means "not selected" for the select inputs */
export interface ProjectForm {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  capacity: number;
  status: string;
  categoryId: number | '';
  ownerId: number | '';
}

/** Message of an Error, or a fallback for anything else that was thrown */
export function errorMessage(err: unknown, fallback = 'Unexpected error'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
