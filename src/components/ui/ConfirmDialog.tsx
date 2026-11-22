import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'تایید و اجرا',
  cancelLabel = 'انصراف',
  tone = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${
            tone === 'danger'
              ? 'bg-[#fef3f2] border-[#fecaca] text-[#b42318]'
              : 'bg-[#eef3fc] border-[#c7d7f8] text-[#0f49bd]'
          }`}
        >
          <AlertTriangle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <p className="text-xs leading-6 text-[#52565e]">{description}</p>
      </div>
    </Modal>
  );
}
