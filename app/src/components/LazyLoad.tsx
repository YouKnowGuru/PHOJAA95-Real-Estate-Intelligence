import React, { useState, useEffect, lazy, Suspense as ReactSuspense } from "react";
import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";
import { useIntersectionObserver } from "@/lib/optimization";

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function LazyWrapper({ children, fallback }: LazyWrapperProps) {
  return <ReactSuspense fallback={fallback || <Skeleton className="h-32" />}>{children}</ReactSuspense>;
}

export function createLazyComponent<T extends React.ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(importFn);
}

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: ReactNode;
}

export function LazyImage({ src, alt, className, placeholder }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
    img.src = src;
  }, [src]);

  if (error) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className}`}>
        <span className="text-muted-foreground text-sm">Failed to load</span>
      </div>
    );
  }

  if (!loaded) {
    return placeholder || <Skeleton className={className} />;
  }

  return <img src={src} alt={alt} className={className} />;
}

export function useLazyLoad(threshold = 0.1) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [ref, isIntersecting] = useIntersectionObserver({
    threshold,
    rootMargin: "50px",
  });

  useEffect(() => {
    if (isIntersecting) {
      setIsLoaded(true);
    }
  }, [isIntersecting]);

  return { ref, isLoaded };
}
