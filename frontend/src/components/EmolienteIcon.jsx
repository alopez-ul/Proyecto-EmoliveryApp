// Vaso de emoliente humeante con una ramita de hierbas.
export default function EmolienteIcon({ size = 48, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Emoliente"
    >
      {/* vapor */}
      <g fill="none" stroke="#c9b8a3" strokeWidth="2.5" strokeLinecap="round">
        <path d="M24 16c-3-3 3-5 0-9" />
        <path d="M32 15c-3-3 3-5 0-9" />
        <path d="M40 16c-3-3 3-5 0-9" />
      </g>
      {/* vaso */}
      <path d="M14 20h36l-4 36a4 4 0 0 1-4 3.6H22a4 4 0 0 1-4-3.6z" fill="#fff8ec" stroke="#5a3a22" strokeWidth="2.5" strokeLinejoin="round" />
      {/* emoliente */}
      <path d="M16.3 30h31.4l-3 26.2a2 2 0 0 1-2 1.8H21.3a2 2 0 0 1-2-1.8z" fill="#c8641e" />
      <path d="M16.3 30h31.4l-.5 4.5H16.8z" fill="#e89a3c" />
      {/* linaza / burbujas */}
      <g fill="#f3c27a">
        <circle cx="26" cy="42" r="1.6" />
        <circle cx="35" cy="47" r="1.3" />
        <circle cx="30" cy="52" r="1.1" />
        <circle cx="39" cy="40" r="1.2" />
      </g>
      {/* ramita de hierbas */}
      <path d="M44 32 52 10" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M49 18c4-1 6 1 6 1s-3 3-7 2z" fill="#3f8f4d" />
      <path d="M47 24c-4-1-6 1-6 1s3 3 7 2z" fill="#3f8f4d" />
      <path d="M51 13c3-2 5-1 5-1s-1 3-4 3.5z" fill="#3f8f4d" />
    </svg>
  )
}
