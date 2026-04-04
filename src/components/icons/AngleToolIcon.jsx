/** Open angle: two rays from vertex, base omitted (chevron / incomplete triangle with dots). */
export function AngleToolIcon({ className = 'size-4', strokeWidth = 1.75 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 17 6 8" />
      <path d="M12 17 18 8" />
      <circle cx="12" cy="17" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18" cy="8" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  )
}
