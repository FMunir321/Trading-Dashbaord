'use client';

import React, { type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled frontend error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm">Please refresh the page. If the issue continues, sign in again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
