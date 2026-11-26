/**
 * Shared class names for the dashboard, so every tab uses the same buttons,
 * fields, cards and badges. `bg-[var(--card-bg)]` instead of `bg-white`
 * keeps cards distinct from the page in dark mode (index.css repaints any
 * `bg-white` with the page background).
 */
const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimary = `${btn} bg-brand px-4 py-2 text-on-brand shadow-sm hover:bg-brand-hover`;
export const btnSecondary = `${btn} border border-gray-300 px-3.5 py-1.5 text-gray-700 hover:bg-gray-100`;
export const btnDanger = `${btn} border border-danger/40 px-3.5 py-1.5 text-danger hover:bg-danger hover:!text-white`;

export const field =
  "w-full rounded-xl border border-gray-300 bg-[var(--card-bg)] px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
export const label = "mb-1 block text-sm font-medium text-gray-700";

export const card = "mb-3 rounded-2xl border border-gray-200 bg-[var(--card-bg)] p-4 transition-shadow hover:shadow-md";
export const empty = "rounded-2xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500";

export const overlay = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm";
export const modal = "w-full rounded-2xl bg-[var(--card-bg)] p-6 shadow-2xl";
export const modalTitle = "mb-4 text-xl md:text-2xl font-bold";

const badgeBase = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
const badgeTone: Record<string, string> = {
  active: "bg-brand-100 text-brand-700",
  open: "bg-brand-100 text-brand-700",
  finished: "bg-gray-200 text-gray-700",
  closed: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  admin: "bg-ink text-white",
  coordinator: "bg-brand-100 text-brand-700",
  volunteer: "bg-gray-200 text-gray-700",
};
export const badge = (tone?: string | null) => `${badgeBase} ${badgeTone[tone || ""] || "bg-gray-200 text-gray-700"}`;
