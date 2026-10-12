"use client";

import { Component, type ReactNode } from "react";

import { Button } from "./Button";
import { Card } from "./Card";

export interface SectionErrorBoundaryProps {
  title: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches a render error from one results-page section (e.g. a bad photo
 * URL throwing inside `MoodboardCard`) and renders a small fallback card
 * instead of taking down the whole page. "Reintentar" just clears the
 * error flag and re-renders `children`, so a transient failure (or one
 * fixed by a prop change from the parent) can recover without a full
 * page reload.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(`Section "${this.props.title}" failed to render`, error);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Card padding="md" className="space-y-space-sm text-center">
        <h3 className="font-label-lg text-label-lg font-bold text-primary">{this.props.title}</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Esta sección no se pudo mostrar
        </p>
        <Button variant="surface" onClick={this.handleRetry}>
          Reintentar
        </Button>
      </Card>
    );
  }
}
