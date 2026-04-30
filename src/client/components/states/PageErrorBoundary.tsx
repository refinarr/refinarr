"use client";
import { Component, type ReactNode } from "react";
import { MediaErrorCard } from "./MediaErrorCard";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <MediaErrorCard
            message={this.state.message}
            onRetry={() => this.setState({ hasError: false })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
