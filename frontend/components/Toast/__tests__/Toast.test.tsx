import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToastContext } from '../index';

function TestTrigger({ message, type, duration }: { message: string; type: 'success' | 'error'; duration?: number }) {
  const { showToast } = useToastContext();
  return (
    <button onClick={() => showToast({ message, type, duration })}>
      Trigger Toast
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render toast with correct message', () => {
    render(
      <ToastProvider>
        <TestTrigger message="Operation completed" type="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Trigger Toast').click();
    });
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
  });

  it('should render success toast with green styling', () => {
    render(
      <ToastProvider>
        <TestTrigger message="Saved successfully" type="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Trigger Toast').click();
    });
    const toast = screen.getByTestId('toast-success');
    expect(toast.className).toContain('bg-green-600');
  });

  it('should render error toast with red styling', () => {
    render(
      <ToastProvider>
        <TestTrigger message="Something failed" type="error" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Trigger Toast').click();
    });
    const toast = screen.getByTestId('toast-error');
    expect(toast.className).toContain('bg-red-600');
  });

  it('should remove toast after default duration', () => {
    render(
      <ToastProvider>
        <TestTrigger message="Temporary message" type="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Trigger Toast').click();
    });
    expect(screen.getByText('Temporary message')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Temporary message')).not.toBeInTheDocument();
  });

  it('should remove toast after custom duration', () => {
    render(
      <ToastProvider>
        <TestTrigger message="Quick message" type="success" duration={1000} />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Trigger Toast').click();
    });
    expect(screen.getByText('Quick message')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Quick message')).not.toBeInTheDocument();
  });

  it('should stack multiple toasts simultaneously', () => {
    function MultiTrigger() {
      const { showToast } = useToastContext();
      return (
        <div>
          <button onClick={() => showToast({ message: 'First toast', type: 'success' })}>First</button>
          <button onClick={() => showToast({ message: 'Second toast', type: 'error' })}>Second</button>
        </div>
      );
    }
    render(
      <ToastProvider>
        <MultiTrigger />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('First').click();
      screen.getByText('Second').click();
    });
    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('should render toast container in document body via portal', () => {
    render(
      <ToastProvider>
        <TestTrigger message="Portal test" type="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Trigger Toast').click();
    });
    const container = screen.getByTestId('toast-container');
    expect(container.parentElement).toBe(document.body);
  });

  it('should have accessible role and aria-live attributes', () => {
    render(
      <ToastProvider>
        <TestTrigger message="Accessible toast" type="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText('Trigger Toast').click();
    });
    const toast = screen.getByTestId('toast-success');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });
});
