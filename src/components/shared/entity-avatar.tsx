"use client";

import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";

/** Generic photo-or-initials avatar, same display rules as AdminAvatar but for any entity. */
export function EntityAvatar({
  name,
  avatarColor = "teal",
  photo,
  size = "md",
  className,
}: {
  name: string;
  avatarColor?: string;
  photo?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-12 w-12 text-sm",
    lg: "h-20 w-20 text-2xl",
  }[size];

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={cn(sizeClasses, "rounded-full object-cover shadow ring-2 ring-background shrink-0", className)}
      />
    );
  }

  return (
    <div className={cn(sizeClasses, "rounded-full bg-gradient-to-br flex items-center justify-center shadow ring-2 ring-background shrink-0", avatarGradient(avatarColor), className)}>
      <span className="font-serif font-bold text-white drop-shadow">{initials(name)}</span>
    </div>
  );
}
