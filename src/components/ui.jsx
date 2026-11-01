import { useEffect, useRef } from "react";
import {
  X,
  CalendarBlank,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";

export function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.93a6 6 0 0 1 0-3.86V7.48H3.07a10 10 0 0 0 0 9.04l3.33-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.33 2.59C7.19 7.71 9.4 5.95 12 5.95Z"
      />
    </svg>
  );
}
export function Brand({ compact = false }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-symbol">
        <CalendarBlank size={22} weight="bold" />
      </span>
      <span>
        시간표<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Field({ label, id, error, children, hint }) {
  return (
    <div className={`field ${error ? "field-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span className="field-message" id={`${id}-error`} role="alert">
          <WarningCircle size={15} />
          {error}
        </span>
      )}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby="modal-title"
      aria-describedby={subtitle ? "modal-subtitle" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id="modal-title">{title}</h2>
          {subtitle && <p id="modal-subtitle">{subtitle}</p>}
        </div>
        <button
          className="icon-btn close-btn"
          aria-label="닫기"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        <span className="toggle-description">{description}</span>
      </span>
      <span className="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label={label}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch-track">
          <span />
        </span>
      </span>
    </label>
  );
}
export function Notice({
  title,
  body,
  time = "지금",
  onClose,
  className = "",
}) {
  return (
    <div className={`notice ${className}`}>
      <span className="notice-icon">
        <CalendarBlank size={21} weight="bold" />
      </span>
      <div className="notice-content">
        <div className="notice-meta">
          <strong>시간표</strong>
          <span>{time}</span>
        </div>
        <p className="notice-title">{title}</p>
        {body && <p className="notice-body">{body}</p>}
      </div>
      {onClose && (
        <button
          className="notice-close icon-btn"
          aria-label="알림 닫기"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div
      className={`toast ${toast.notification ? "toast-notification" : ""}`}
      role="status"
      aria-live="polite"
    >
      {toast.notification ? (
        <Notice title={toast.title} body={toast.body} onClose={onClose} />
      ) : (
        <>
          <CheckCircle size={21} weight="fill" />
          <span>{toast.title}</span>
          <button className="icon-btn" aria-label="안내 닫기" onClick={onClose}>
            <X size={16} />
          </button>
        </>
      )}
    </div>
  );
}
