import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveQuestion, fetchQuestions, rejectQuestion } from '../../features/questions/questionsApi';
import { getApiErrorMessage } from '../../lib/api-client';
import { useToast } from '../../components/ToastProvider';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/StateViews';
import { Pagination } from '../../components/Pagination';
import { Badge, Button, Card, PageHeader } from '../../components/ui/Card';
import { HelpCircleIcon } from '../../components/ui/Icons';
import type { ContentStatus, Question } from '../../types/api';
import { CreateQuestionForm } from './components/CreateQuestionForm';
import { GenerateQuestionsForm } from './components/GenerateQuestionsForm';
import { ImportExamForm } from './components/ImportExamForm';
import { PAGE_LIMIT, SOURCE_LABEL, TABS, TYPE_LABEL } from './components/adminQuestionsConstants';

export function AdminQuestionsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ContentStatus | ''>('PENDING_APPROVAL');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [rejecting, setRejecting] = useState<Question | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-questions', status, page],
    queryFn: () => fetchQuestions(status || undefined, page, PAGE_LIMIT),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-questions'] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveQuestion(id),
    onSuccess: () => {
      showToast('Đã duyệt câu hỏi vào kho dùng chung', 'success');
      invalidate();
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuestion(rejecting!.id, reason || undefined),
    onSuccess: () => {
      showToast('Đã từ chối câu hỏi', 'success');
      setRejecting(null);
      setReason('');
      invalidate();
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  function handleReject(e: FormEvent) {
    e.preventDefault();
    rejectMutation.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Câu hỏi"
        subtitle="Ngân hàng câu hỏi dùng chung — tạo thủ công hoặc để AI tự soạn nội dung mới"
        icon={<HelpCircleIcon className="h-5 w-5" />}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              + Nhập đề thật
            </Button>
            <Button variant="secondary" onClick={() => setShowGenerate(true)}>
              + AI sinh câu hỏi
            </Button>
            <Button onClick={() => setShowCreate(true)}>+ Tạo thủ công</Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`rounded-xl border px-3.5 py-1.5 font-medium transition ${
              status === tab.value
                ? 'border-transparent bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={getApiErrorMessage(error)} />}
      {data && data.data.length === 0 && <EmptyState label="Không có câu hỏi nào ở trạng thái này." />}

      <div className="space-y-3">
        {data?.data.map((q) => (
          <Card key={q.id} className="p-4">
            <div className="mb-1 flex items-start justify-between gap-3">
              <p className="font-medium text-slate-900 dark:text-slate-100">{q.content}</p>
              <Badge
                variant={q.status === 'APPROVED' ? 'emerald' : q.status === 'REJECTED' ? 'red' : 'amber'}
                className="shrink-0"
              >
                {q.status === 'APPROVED' ? 'Đã duyệt' : q.status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt'}
              </Badge>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs text-slate-500">{TYPE_LABEL[q.type]}</p>
              <Badge variant={SOURCE_LABEL[q.source].variant}>{SOURCE_LABEL[q.source].label}</Badge>
            </div>
            {q.status === 'REJECTED' && q.rejectReason && (
              <p className="mb-2 text-xs text-red-600 dark:text-red-400">Lý do từ chối: {q.rejectReason}</p>
            )}
            {(q.status === 'PENDING_APPROVAL' || q.status === 'APPROVED') && (
              <div className="flex gap-2">
                {q.status === 'PENDING_APPROVAL' && (
                  <Button
                    variant="success"
                    onClick={() => approveMutation.mutate(q.id)}
                    disabled={approveMutation.isPending}
                    className="px-3 py-1.5 text-xs"
                  >
                    Duyệt
                  </Button>
                )}
                <Button variant="danger" onClick={() => setRejecting(q)} className="px-3 py-1.5 text-xs">
                  {q.status === 'APPROVED' ? 'Rút khỏi kho chung' : 'Từ chối'}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      {data && (
        <Pagination page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} />
      )}

      {showCreate && (
        <Modal title="Tạo câu hỏi thủ công" onClose={() => setShowCreate(false)}>
          <CreateQuestionForm onDone={() => setShowCreate(false)} />
        </Modal>
      )}

      {showGenerate && (
        <Modal title="AI sinh câu hỏi mới" onClose={() => setShowGenerate(false)}>
          <GenerateQuestionsForm onDone={() => setShowGenerate(false)} />
        </Modal>
      )}

      {showImport && (
        <Modal title="Nhập câu hỏi từ đề thi thật" onClose={() => setShowImport(false)}>
          <ImportExamForm onDone={() => setShowImport(false)} />
        </Modal>
      )}

      {rejecting && (
        <Modal title="Từ chối / rút câu hỏi" onClose={() => setRejecting(null)}>
          <form onSubmit={handleReject} className="flex flex-col gap-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do từ chối (tuỳ chọn)"
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              disabled={rejectMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
