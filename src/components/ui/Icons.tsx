import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowUpIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Base>
);

export const StopIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
  </Base>
);

export const CopyIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Base>
);

export const CheckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Base>
);

export const RetryIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 11a8 8 0 1 0-2.34 5.66" />
    <path d="M20 4v7h-7" />
  </Base>
);

export const ThumbUpIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M7 11v9H4v-9h3zM7 11l4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 20H7" />
  </Base>
);

export const ThumbDownIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M17 13V4h3v9h-3zM17 13l-4 7a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.7 4H17" />
  </Base>
);

export const FlagIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Base>
);

export const PenIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </Base>
);

export const MenuIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Base>
);

export const SidebarIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
  </Base>
);

export const CloseIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const TrashIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Base>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M15 18l-6-6 6-6" />
  </Base>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 18l6-6-6-6" />
  </Base>
);

export const ZoomInIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20.5 20.5l-4.55-4.55M11 8v6M8 11h6" />
  </Base>
);

export const ZoomOutIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20.5 20.5l-4.55-4.55M8 11h6" />
  </Base>
);

export const FitPageIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    <rect x="8" y="8" width="8" height="8" rx="1" />
  </Base>
);

export const HighlighterIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 11l-6 6v3h9l3-3" />
    <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </Base>
);

export const FileTextIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Base>
);

export const DownloadIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 4v11M7 10.5l5 5 5-5" />
    <path d="M5 19.5h14" />
  </Base>
);

export const ExternalLinkIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M15 3h6v6M10 14L21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </Base>
);

export const ArrowDownIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M5 12l7 7 7-7" />
  </Base>
);

export const DashboardIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Base>
);

export const BookIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5zM9 7h7M9 11h5" />
  </Base>
);

export const BadgeCheckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </Base>
);

export const LayoutIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M9 20V9" />
  </Base>
);

export const SparklesIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </Base>
);

export const FolderIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Base>
);

export const ImageIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="9" cy="9.5" r="1.8" />
    <path d="M21 16l-5-5-9 9" />
  </Base>
);

export const DatabaseIcon = (props: IconProps) => (
  <Base {...props}>
    <ellipse cx="12" cy="5.5" rx="8" ry="2.5" />
    <path d="M4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5" />
  </Base>
);

export const ListIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const UserIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Base>
);

export const LogoutIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 16l-4-4 4-4M6 12h10" />
  </Base>
);

export const SearchIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20.5 20.5l-4.55-4.55" />
  </Base>
);

export const PlusIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const UploadIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 16V5M7 9.5l5-5 5 5" />
    <path d="M5 19.5h14" />
  </Base>
);

export const LockIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </Base>
);

export const EyeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const EyeOffIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Base>
);

export const MailIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
  </Base>
);

export const AlertIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3.5l9.5 16.5h-19z" />
    <path d="M12 10v4.5M12 17.5v.01" />
  </Base>
);

export const HomeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3.5 11L12 4l8.5 7M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-5h4v5" />
  </Base>
);

export const QuranIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V20" />
  </Base>
);

export const InboxIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 13l2.6-7.2A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.3L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 13h5l1.5 2.5h5L16 13h5" />
  </Base>
);

export const ChartIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </Base>
);

export const WrenchIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L3.5 17.5a2.1 2.1 0 0 0 3 3l6-6a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z" />
  </Base>
);

export const UsersIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
  </Base>
);

export const QuestionIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 14.5z" />
    <path d="M9.8 8.2a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5M12 14.2v.01" />
  </Base>
);
