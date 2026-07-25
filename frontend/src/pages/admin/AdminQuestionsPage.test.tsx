import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AdminQuestionsPage } from './AdminQuestionsPage';
import * as questionsApi from '../../features/questions/questionsApi';
import type { Question } from '../../types/api';

vi.mock('../../features/questions/questionsApi');

const pendingQuestion: Question = {
  id: 'q-1',
  subjectId: 'subject-1',
  topicId: 'topic-1',
  type: 'MULTIPLE_CHOICE',
  difficulty: 'KNOWLEDGE',
  content: 'Đạo hàm của x^2 là?',
  options: ['2x', 'x'],
  correctAnswer: { index: 0 },
  explanation: null,
  createdById: 'admin-1',
  status: 'PENDING_APPROVAL',
  rejectReason: null,
  source: 'AI_GENERATED',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('AdminQuestionsPage', () => {
  it('defaults to the "pending approval" tab and lists questions awaiting review', async () => {
    vi.mocked(questionsApi.fetchQuestions).mockResolvedValue([pendingQuestion]);
    renderWithProviders(<AdminQuestionsPage />);

    expect(await screen.findByText('Đạo hàm của x^2 là?')).toBeInTheDocument();
    expect(questionsApi.fetchQuestions).toHaveBeenCalledWith('PENDING_APPROVAL');
  });

  it('shows an empty state when there is nothing to review', async () => {
    vi.mocked(questionsApi.fetchQuestions).mockResolvedValue([]);
    renderWithProviders(<AdminQuestionsPage />);

    expect(await screen.findByText('Không có câu hỏi nào ở trạng thái này.')).toBeInTheDocument();
  });

  it('approves a pending question, moving it into the shared bank', async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.fetchQuestions).mockResolvedValue([pendingQuestion]);
    vi.mocked(questionsApi.approveQuestion).mockResolvedValue({
      ...pendingQuestion,
      status: 'APPROVED',
    });

    renderWithProviders(<AdminQuestionsPage />);
    await screen.findByText('Đạo hàm của x^2 là?');

    await user.click(screen.getByRole('button', { name: 'Duyệt' }));

    await waitFor(() => {
      expect(questionsApi.approveQuestion).toHaveBeenCalledWith('q-1');
    });
  });

  it('rejects a question with the entered reason', async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.fetchQuestions).mockResolvedValue([pendingQuestion]);
    vi.mocked(questionsApi.rejectQuestion).mockResolvedValue({
      ...pendingQuestion,
      status: 'REJECTED',
    });

    renderWithProviders(<AdminQuestionsPage />);
    await screen.findByText('Đạo hàm của x^2 là?');

    await user.click(screen.getByRole('button', { name: 'Từ chối' }));
    await user.type(screen.getByPlaceholderText('Lý do từ chối (tuỳ chọn)'), 'Sao chép đề thi chính thức');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => {
      expect(questionsApi.rejectQuestion).toHaveBeenCalledWith('q-1', 'Sao chép đề thi chính thức');
    });
  });
});
