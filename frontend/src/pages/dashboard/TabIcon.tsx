/** Small outline icons for the dashboard navigation (decorative). */
const PATHS: Record<string, string> = {
  profile: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0",
  myprojects: "M5 4h14v16l-7-4-7 4z",
  projects: "M3 7h18v13H3zM8 7V4h8v3",
  categories: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  reviews: "M4 5h16v11H8l-4 4z",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zm-6 9a6 6 0 0112 0M17 11a3 3 0 100-6M21 20a5 5 0 00-4-4.9",
  contacts: "M12 9v4m0 4h.01M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  analytics: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
};

export default function TabIcon({ tab, className = "h-5 w-5 shrink-0" }: { tab: string; className?: string }) {
  const d = PATHS[tab];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
