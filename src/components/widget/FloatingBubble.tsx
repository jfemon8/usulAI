import { clsx } from "clsx";
import { LogoMark } from "@/components/ui/Logo";

interface FloatingBubbleProps {
  onClick: () => void;
  className?: string;
}

export function FloatingBubble({ onClick, className }: FloatingBubbleProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Open Usul AI chat"
      className={clsx(
        "glass glass-sheen fixed right-5 bottom-5 flex h-14 w-14 items-center justify-center",
        "rounded-full text-(--accent) transition duration-200",
        "hover:brightness-[1.08] active:scale-[0.96]",
        className,
      )}
    >
      <LogoMark className="h-7 w-7" />
    </button>
  );
}
