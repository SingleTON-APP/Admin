import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

export function Dialog({
  open,
  title,
  children,
  onClose,
  dismissDisabled = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        if (dismissDisabled) event.preventDefault();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          disabled={dismissDisabled}
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function ActionDialog({
  open,
  action,
  destructive,
  onClose,
}: {
  open: boolean;
  action: string;
  destructive?: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    onClose();
    setReason('');
  }
  return (
    <Dialog open={open} title={action} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Срок
          <select>
            <option>7 дней</option>
            <option>24 часа</option>
            <option>30 дней</option>
            <option>Навсегда</option>
          </select>
        </label>
        <label>
          Причина
          <select>
            <option>Спам</option>
            <option>Угрозы</option>
            <option>Запрещённый контент</option>
          </select>
        </label>
        <label>
          Внутренний комментарий
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Контекст для других модераторов"
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            className={`button ${destructive ? 'danger' : 'primary'}`}
            disabled={!reason}
          >
            {action}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
