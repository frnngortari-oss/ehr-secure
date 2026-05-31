"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function SubmitButton({ children, pendingText = "Guardando...", className, style }: Props) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} style={style} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
