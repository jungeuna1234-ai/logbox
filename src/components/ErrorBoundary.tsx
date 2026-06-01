import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || '알 수 없는 오류' };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[LogBox] ErrorBoundary', err, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0f0f10] p-6 shadow-xl">
            <h1 className="text-lg font-bold text-[color:var(--accent)]">문제가 발생했습니다</h1>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">
              화면을 그리는 중 오류가 났습니다. 환경 변수(특히 VITE_GOOGLE_CLIENT_ID)나 최근 변경한 코드를 확인해 주세요.
            </p>
            <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-gray-400 whitespace-pre-wrap break-all">
              {this.state.message}
            </pre>
            <button
              type="button"
              className="mt-6 w-full py-3 rounded-xl font-semibold bg-[color:var(--accent)] text-black"
              onClick={() => window.location.reload()}
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
