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

export const UndoIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Base>
);

export const RedoIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Base>
);

export const BoldIcon = (props: IconProps) => (
  <Base {...props} strokeWidth={2.2}>
    <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
    <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
  </Base>
);

export const ItalicIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M19 4h-9M14 20H5M15 4 9 20" />
  </Base>
);

export const StrikeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M16 6.5C15.2 5 13.7 4 11.8 4 9.2 4 7.5 5.5 7.5 7.5c0 1.6 1 2.6 2.7 3.3" />
    <path d="M4 12h16" />
    <path d="M8 17.5c.8 1.5 2.4 2.5 4.3 2.5 2.7 0 4.5-1.6 4.5-3.7 0-.9-.3-1.7-.9-2.3" />
  </Base>
);

export const CodeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
  </Base>
);

export const CodeBlockIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m9.5 10-2 2 2 2M14.5 10l2 2-2 2" />
  </Base>
);

export const LinkIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </Base>
);

export const BulletListIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </Base>
);

export const OrderedListIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 5l1.5-1v5M3.5 9h3" strokeWidth={1.4} />
    <path d="M3.6 14.2a1.3 1.3 0 0 1 2.4.6c0 .9-2.4 2-2.4 3.2h2.6" strokeWidth={1.4} />
  </Base>
);

export const QuoteIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 6v12M9 8h11M9 12h11M9 16h7" />
  </Base>
);

export const RuleIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 12h18" />
    <path d="M7 6h10M7 18h10" strokeOpacity={0.45} />
  </Base>
);

export const TableIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M3 15h18M9.5 4v16M14.5 4v16" />
  </Base>
);

export const RowAddIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="8" rx="2" />
    <path d="M12 15v6M9 18h6" />
  </Base>
);

export const RowDeleteIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="8" rx="2" />
    <path d="M9 18h6" />
  </Base>
);

export const ColumnAddIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="8" height="18" rx="2" />
    <path d="M15 12h6M18 9v6" />
  </Base>
);

export const ColumnDeleteIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="4" y="3" width="8" height="18" rx="2" />
    <path d="M15 12h6" />
  </Base>
);

export const TableDeleteIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Base>
);

export const RtlIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M10 4v10M14 4v16M17 4H9.5a3.5 3.5 0 0 0 0 7H10" />
    <path d="m7 17-3 1.5L7 20M4 18.5h6" strokeWidth={1.5} />
  </Base>
);

export const CitationIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M8 4H5v16h3M16 4h3v16h-3" />
    <path d="M12 9v6" />
  </Base>
);

export const MathIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M18 5H6l6 7-6 7h12" />
  </Base>
);

export const ClearFormatIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 5h12M12 5l-3 14" />
    <path d="m15 14 5 5M20 14l-5 5" />
  </Base>
);

export const MarkdownIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M6 15V9l2.5 3L11 9v6M16 9v6M14 13l2 2 2-2" />
  </Base>
);

export const PreviewIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const WriteIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Base>
);

export const ExpandIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </Base>
);

export const CollapseIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
  </Base>
);
