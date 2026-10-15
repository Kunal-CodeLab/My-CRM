import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DealsKanbanView } from '../DealsKanbanView';
import { ToastProvider } from '../Toast';
import { crmApi, ApiError } from '../../auth/api-client';

vi.mock('../../auth/api-client', () => ({
  crmApi: {
    listPipelines: vi.fn(),
    listDeals: vi.fn(),
    transitionDealStage: vi.fn(),
    createDeal: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public problem: any) {
      super(problem?.detail || 'API Error');
    }
  },
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<ToastProvider>{ui}</ToastProvider>);
};

describe('DealsKanbanView Component & Optimistic UI Suite', () => {
  const mockStages = [
    {
      id: 'stage-1',
      tenantId: 'tenant-1',
      pipelineId: 'pipe-1',
      name: 'Lead Qualified',
      displayOrder: 0,
      probabilityPercentage: 20,
      isWon: false,
      isLost: false,
      createdAt: '2026-10-15T00:00:00Z',
    },
    {
      id: 'stage-2',
      tenantId: 'tenant-1',
      pipelineId: 'pipe-1',
      name: 'Proposal Sent',
      displayOrder: 1,
      probabilityPercentage: 60,
      isWon: false,
      isLost: false,
      createdAt: '2026-10-15T00:00:00Z',
    },
    {
      id: 'stage-3',
      tenantId: 'tenant-1',
      pipelineId: 'pipe-1',
      name: 'Closed Lost',
      displayOrder: 2,
      probabilityPercentage: 0,
      isWon: false,
      isLost: true,
      createdAt: '2026-10-15T00:00:00Z',
    },
  ];

  const mockPipelines = [
    {
      id: 'pipe-1',
      name: 'Direct Enterprise Pipeline',
      isDefault: true,
      stages: mockStages,
    },
    {
      id: 'pipe-2',
      name: 'Channel Partners Pipeline',
      isDefault: false,
      stages: [
        {
          id: 'stage-p2-1',
          tenantId: 'tenant-1',
          pipelineId: 'pipe-2',
          name: 'Partner Registered',
          displayOrder: 0,
          probabilityPercentage: 10,
          isWon: false,
          isLost: false,
          createdAt: '2026-10-15T00:00:00Z',
        },
      ],
    },
  ];

  const mockDeals = [
    {
      id: 'deal-101',
      title: 'Global Retail Cloud Expansion',
      value: '75000.00',
      pipelineId: 'pipe-1',
      stageId: 'stage-1',
      version: 1,
      createdAt: '2026-10-15T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (crmApi.listPipelines as any).mockResolvedValue(mockPipelines);
    (crmApi.listDeals as any).mockResolvedValue(mockDeals);
  });

  it('1. Render & Data Ingestion: Displays pipeline stages, switcher, and deal cards', async () => {
    renderWithProviders(<DealsKanbanView />);

    await waitFor(() => {
      expect(screen.getByText('Lead Qualified')).toBeDefined();
      expect(screen.getByText('Proposal Sent')).toBeDefined();
      expect(screen.getByText('Closed Lost')).toBeDefined();
    });

    expect(screen.getByText('Global Retail Cloud Expansion')).toBeDefined();
    expect(screen.getByText('75,000.00')).toBeDefined();
    expect(screen.getByText(/v1/)).toBeDefined();

    // Verify pipeline switcher is present
    const select = screen.getByLabelText('Select Pipeline') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('pipe-1');
  });

  it('2. Pipeline Switching: Changes active pipeline and loads corresponding deals', async () => {
    const partnerDeals = [
      {
        id: 'deal-201',
        title: 'Partner Reseller Agreement',
        value: '120000.00',
        pipelineId: 'pipe-2',
        stageId: 'stage-p2-1',
        version: 1,
        createdAt: '2026-10-15T00:00:00Z',
      },
    ];

    (crmApi.listDeals as any).mockImplementation((params: any) => {
      if (params?.pipelineId === 'pipe-2') {
        return Promise.resolve(partnerDeals);
      }
      return Promise.resolve(mockDeals);
    });

    renderWithProviders(<DealsKanbanView />);

    await waitFor(() => {
      expect(screen.getByText('Global Retail Cloud Expansion')).toBeDefined();
    });

    const select = screen.getByLabelText('Select Pipeline');
    fireEvent.change(select, { target: { value: 'pipe-2' } });

    await waitFor(() => {
      expect(crmApi.listDeals).toHaveBeenCalledWith({ pipelineId: 'pipe-2' });
      expect(screen.getByText('Partner Registered')).toBeDefined();
      expect(screen.getByText('Partner Reseller Agreement')).toBeDefined();
    });
  });

  it('3. Optimistic Transition Success: Advances deal stage and displays success confirmation', async () => {
    (crmApi.transitionDealStage as any).mockResolvedValue({
      ...mockDeals[0],
      stageId: 'stage-2',
      version: 2,
    });

    renderWithProviders(<DealsKanbanView />);

    await waitFor(() => {
      expect(screen.getByText('Global Retail Cloud Expansion')).toBeDefined();
    });

    const advanceButton = screen.getByTitle('Advance to Proposal Sent');
    fireEvent.click(advanceButton);

    await waitFor(() => {
      expect(crmApi.transitionDealStage).toHaveBeenCalledWith('deal-101', {
        newStageId: 'stage-2',
        expectedVersion: 1,
      });
      expect(screen.getAllByText(/Stage updated: "Global Retail Cloud Expansion"/).length).toBeGreaterThan(0);
    });
  });

  it('4. Closed Lost Interception: Prompts for lost reason and submits to transitionDealStage', async () => {
    // Deal is in stage-2
    (crmApi.listDeals as any).mockResolvedValue([
      {
        ...mockDeals[0],
        stageId: 'stage-2',
      },
    ]);

    (crmApi.transitionDealStage as any).mockResolvedValue({
      ...mockDeals[0],
      stageId: 'stage-3',
      version: 2,
      lostReason: 'Client budget frozen / cancelled',
    });

    renderWithProviders(<DealsKanbanView />);

    await waitFor(() => {
      expect(screen.getByText('Global Retail Cloud Expansion')).toBeDefined();
    });

    // Advance button in stage-2 moves to stage-3 (Closed Lost)
    const advanceToLostButton = screen.getByTitle('Advance to Closed Lost');
    fireEvent.click(advanceToLostButton);

    // Verify Lost Reason modal opens
    await waitFor(() => {
      expect(screen.getByText('Record Lost Deal Reason')).toBeDefined();
    });

    // Select reason
    const reasonSelect = screen.getByDisplayValue('Competitor pricing lower');
    fireEvent.change(reasonSelect, { target: { value: 'Client budget frozen / cancelled' } });

    // Confirm
    const confirmBtn = screen.getByText('Confirm Closed Lost');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(crmApi.transitionDealStage).toHaveBeenCalledWith('deal-101', {
        newStageId: 'stage-3',
        expectedVersion: 1,
        lostReason: 'Client budget frozen / cancelled',
      });
      expect(screen.getAllByText(/Deal closed lost: "Global Retail Cloud Expansion"/).length).toBeGreaterThan(0);
    });
  });

  it('5. Optimistic Transition Rollback: Restores previous stage on 409 Conflict', async () => {
    (crmApi.transitionDealStage as any).mockRejectedValue(
      new ApiError(409, {
        type: 'https://api.crm.domain/errors/conflict',
        title: 'Conflict',
        status: 409,
        detail: 'Version conflict: Record was updated by another sales rep.',
        instance: '/api/v1/deals/deal-101/stage',
        traceId: 'trace-409',
      })
    );

    renderWithProviders(<DealsKanbanView />);

    await waitFor(() => {
      expect(screen.getByText('Global Retail Cloud Expansion')).toBeDefined();
    });

    const advanceButton = screen.getByTitle('Advance to Proposal Sent');
    fireEvent.click(advanceButton);

    await waitFor(() => {
      expect(screen.getAllByText('Version conflict: Record was updated by another sales rep.').length).toBeGreaterThan(0);
      // Deal version rolled back to v1
      expect(screen.getByText(/v1/)).toBeDefined();
    });
  });
});
