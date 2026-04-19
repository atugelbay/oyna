"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
export type ConfirmDeleteOptions = {
  /** Заголовок окна */
  title?: string;
  /** Основной текст (обязателен) */
  message: string;
  /** Подпись кнопки подтверждения */
  confirmLabel?: string;
  /** Подпись кнопки отмены */
  cancelLabel?: string;
};

type ConfirmDeleteModalProps = ConfirmDeleteOptions & {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const DEFAULT_TITLE = "Подтверждение удаления";

export function ConfirmDeleteModal({
  isOpen,
  title = DEFAULT_TITLE,
  message,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onCancel]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 border-0 bg-black/50 p-0 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Закрыть"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        className="relative z-10 w-full max-w-md rounded-xl border border-surface-border bg-[#141C26] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-delete-title" className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
        <p id="confirm-delete-desc" className="mt-3 text-sm leading-relaxed text-text-secondary">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 min-w-[100px] rounded-xl border border-surface-border bg-transparent px-6 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-12 min-w-[100px] rounded-xl border border-danger bg-danger/10 px-6 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Единый диалог подтверждения удаления. Рендерите {@link dialog} в разметке страницы
 * и вызывайте {@link confirmDelete} перед любым запросом на удаление.
 */
export function useConfirmDelete() {
  const [pending, setPending] = useState<
    | (ConfirmDeleteOptions & {
        resolve: (ok: boolean) => void;
      })
    | null
  >(null);

  const confirmDelete = useCallback((options: ConfirmDeleteOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleCancel = useCallback(() => {
    setPending((current) => {
      if (current) current.resolve(false);
      return null;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setPending((current) => {
      if (current) current.resolve(true);
      return null;
    });
  }, []);

  const dialog =
    pending != null ? (
      <ConfirmDeleteModal
        isOpen
        title={pending.title}
        message={pending.message}
        confirmLabel={pending.confirmLabel}
        cancelLabel={pending.cancelLabel}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    ) : null;

  return { confirmDelete, dialog };
}
