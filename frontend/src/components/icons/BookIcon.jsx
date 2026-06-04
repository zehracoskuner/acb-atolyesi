export default function BookIcon({ size = 18, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M4 4v15.5A2.5 2.5 0 0 1 6.5 22H20V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/>
    </svg>
  );
}
