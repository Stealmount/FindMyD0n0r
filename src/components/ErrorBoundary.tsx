import React, { Component } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
 children: React.ReactNode;
 fallbackMessage?: string;
 /** Preferred UI language for the fallback. 'en' default — the boundary must never throw. */
 lang?: 'en' | 'hi';
}

interface ErrorBoundaryState {
 hasError: boolean;
 error: Error | null;
}

/**
 * ErrorBoundary — catches runtime errors in child components and renders a
 * friendly fallback instead of unmounting the whole app (blank page).
 * Wrap each major view individually so failures stay isolated.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
 constructor(props: ErrorBoundaryProps) {
 super(props);
 this.state = { hasError: false, error: null };
 }

 static getDerivedStateFromError(error: Error): ErrorBoundaryState {
 return { hasError: true, error };
 }

 componentDidCatch(error: Error, info: React.ErrorInfo) {
 console.error('[ErrorBoundary] Caught error:', error, info);
 }

 handleReset = () => {
 this.setState({ hasError: false, error: null });
 };

 render() {
 if (this.state.hasError) {
 const { fallbackMessage, lang = 'en' } = this.props;
 const isHi = lang === 'hi';
 return (
  <div className="bg-white border border-ink-200 p-8 text-center max-w-md mx-auto my-10">
  <div className="mx-auto w-14 h-14 rounded-full bg-blood-50 border border-blood-200 flex items-center justify-center mb-4">
  <AlertCircle className="w-7 h-7 text-blood-700" />
  </div>
  <h2 className="text-lg font-semibold text-ink-900 mb-2">
  {isHi ? 'कुछ गलत हो गया' : 'Something went wrong'}
  </h2>
  <p className="text-sm text-ink-500 mb-4">
  {fallbackMessage ?? (isHi
  ? 'इस अनुभाग में एक अप्रत्याशित त्रुटि हुई। आपका बाकी डेटा सुरक्षित है।'
  : 'An unexpected error occurred in this section. Your other data is safe.')}
  </p>
  {this.state.error && (
  <pre className="text-left text-xs bg-ink-50 border border-ink-100 p-3 mb-4 overflow-x-auto text-ink-600 whitespace-pre-wrap break-words">
  {this.state.error.message}
  </pre>
  )}
  <button
  type="button"
  onClick={this.handleReset}
  className="inline-flex h-11 items-center justify-center gap-2 bg-blood-600 text-white px-5 text-sm font-semibold hover:bg-blood-700 transition-colors"
  >
 <RotateCcw className="w-4 h-4" />
 {isHi ? 'फिर कोशिश करें' : 'Try again'}
 </button>
 </div>
 );
 }
 return this.props.children;
 }
}
