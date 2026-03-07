import React from "react";

type IconName =
  | "home"
  | "patients"
  | "search"
  | "agenda"
  | "evolutions"
  | "new"
  | "kpi"
  | "audit"
  | "backup"
  | "users";

type Props = {
  name: IconName;
  className?: string;
};

export function NavIcon({ name, className }: Props) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10.5V20h14v-9.5" />
        </svg>
      );
    case "patients":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
          <path d="M17 9h4M19 7v4" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case "agenda":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case "evolutions":
      return (
        <svg {...common}>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M14 4v4h4M8 12h8M8 16h8" />
        </svg>
      );
    case "new":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "kpi":
      return (
        <svg {...common}>
          <path d="M4 19h16" />
          <rect x="6" y="12" width="3" height="5" />
          <rect x="11" y="9" width="3" height="8" />
          <rect x="16" y="6" width="3" height="11" />
        </svg>
      );
    case "audit":
      return (
        <svg {...common}>
          <path d="m12 3 7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
          <path d="m9.5 12 2 2 3-3" />
        </svg>
      );
    case "backup":
      return (
        <svg {...common}>
          <path d="M12 16V8" />
          <path d="m8.5 11.5 3.5-3.5 3.5 3.5" />
          <path d="M5 17.5A4.5 4.5 0 1 1 6.5 9a6 6 0 1 1 11 3.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="2.5" />
          <circle cx="16" cy="8" r="2" />
          <path d="M4 18c0-2.6 2.2-4.5 5-4.5s5 1.9 5 4.5" />
          <path d="M14 17c.3-1.6 1.7-2.7 3.5-2.7 1.2 0 2.2.4 2.9 1.1" />
        </svg>
      );
    default:
      return null;
  }
}
