"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/ui";

interface ThumbImageProps {
  src: string;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
}

export function ThumbImage({ src, alt, className, fit = "cover" }: ThumbImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="block w-full overflow-hidden"
        aria-label={`Open ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          className={cn("w-full", fit === "contain" ? "object-contain" : "object-cover", className)}
        />
      </button>

      {isOpen &&
        isMounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4"
            onClick={() => setIsOpen(false)}
          >
            <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-2 top-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 hover:border-slate-500"
              >
                Close
              </button>
              <img src={src} alt={alt} className="max-h-[85vh] w-full rounded border border-slate-300 bg-white object-contain" />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
