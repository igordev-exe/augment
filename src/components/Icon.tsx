// Ícones desenhados à mão (traço 1.8), sem biblioteca.

type Name =
  | "barbell"
  | "calendar"
  | "chart"
  | "book"
  | "guide"
  | "gear"
  | "check"
  | "back"
  | "chev"
  | "plus"
  | "play"
  | "repeat"
  | "trophy"
  | "video"
  | "trash"
  | "clock";

export function Icon({ name, size = 22 }: { name: Name; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "barbell":
      return (
        <svg {...p}>
          <path d="M2 12h20" />
          <rect x="4" y="7" width="3" height="10" rx="1" />
          <rect x="17" y="7" width="3" height="10" rx="1" />
          <rect x="7" y="9" width="2" height="6" rx="0.6" />
          <rect x="15" y="9" width="2" height="6" rx="0.6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      );
    case "chart":
      return (
        <svg {...p}>
          <path d="M4 20V4M4 20h16" />
          <path d="M7 15l4-4 3 3 5-6" />
        </svg>
      );
    case "book":
      return (
        <svg {...p}>
          <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" />
          <path d="M5 17a3 3 0 0 1 3-3h10" />
        </svg>
      );
    case "guide":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
    case "gear":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
        </svg>
      );
    case "check":
      return (
        <svg {...p} strokeWidth={2.4}>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      );
    case "back":
      return (
        <svg {...p}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      );
    case "chev":
      return (
        <svg {...p}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "play":
      return (
        <svg {...p}>
          <path d="M7 5l12 7-12 7V5z" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...p}>
          <path d="M17 2l3 3-3 3" />
          <path d="M4 11V9a4 4 0 0 1 4-4h12" />
          <path d="M7 22l-3-3 3-3" />
          <path d="M20 13v2a4 4 0 0 1-4 4H4" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...p}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
          <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4" />
        </svg>
      );
    case "video":
      return (
        <svg {...p}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="M16 10l5-3v10l-5-3" />
        </svg>
      );
    case "trash":
      return (
        <svg {...p}>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      );
    case "clock":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
  }
}
