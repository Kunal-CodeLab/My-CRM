import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';
import { ErrorBoundary } from '../ErrorBoundary';

const TestToastConsumer = () => {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Operation succeeded')}>Trigger Success</button>
      <button onClick={() => toast.error('Something went wrong')}>Trigger Error</button>
    </div>
  );
};

const FlakyChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Explosive runtime render fault');
  }
  return <div>Clean Content Rendered</div>;
};

describe('Toast & ErrorBoundary Architecture Suite', () => {
  it('1. ToastProvider & useToast: Renders accessible alerts and removes on dismiss', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    const successBtn = screen.getByText('Trigger Success');
    fireEvent.click(successBtn);

    expect(screen.getByText('Operation succeeded')).toBeDefined();

    const closeBtn = screen.getByLabelText('Close notification');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Operation succeeded')).toBeNull();
  });

  it('2. ErrorBoundary: Traps component render fault and renders fallback UI without crash', () => {
    // Suppress console.error in vitest output for expected thrown error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <FlakyChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Unexpected Application Error')).toBeDefined();
    expect(screen.getByText(/Explosive runtime render fault/)).toBeDefined();
    expect(screen.getByText('Reload Workspace')).toBeDefined();

    spy.mockRestore();
  });
});
