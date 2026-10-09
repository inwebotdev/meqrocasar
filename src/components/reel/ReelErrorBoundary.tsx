"use client";

import { Component, type ReactNode } from "react";

export interface ReelErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ReelErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors from the lazily-loaded Remotion player (e.g. a
 * chunk-load failure or a Remotion runtime error) and falls back to the
 * static reel placeholder instead of taking down the whole results page.
 */
export class ReelErrorBoundary extends Component<ReelErrorBoundaryProps, ReelErrorBoundaryState> {
  state: ReelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ReelErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("ReelPlayer failed to render", error);
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
