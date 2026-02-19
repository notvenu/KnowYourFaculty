import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faExclamationCircle,
  faExclamationTriangle,
  faInfoCircle,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { removeToast } from "../../store/uiSlice.js";

const TOAST_ICONS = {
  success: faCheckCircle,
  error: faExclamationCircle,
  warning: faExclamationTriangle,
  info: faInfoCircle,
};

const TOAST_COLORS = {
  success: "bg-(--success)",
  error: "bg-(--danger)",
  warning: "bg-(--warning)",
  info: "bg-(--info)",
};

export default function ToastContainer() {
  const dispatch = useDispatch();
  const toasts = useSelector((state) => state.ui.toasts);

  useEffect(() => {
    toasts.forEach((toast) => {
      const timer = setTimeout(() => {
        dispatch(removeToast(toast.id));
      }, toast.duration);

      return () => clearTimeout(timer);
    });
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-9999 flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${TOAST_COLORS[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-right`}
          role="alert"
        >
          <FontAwesomeIcon
            icon={TOAST_ICONS[toast.type]}
            className="text-xl shrink-0"
          />
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => dispatch(removeToast(toast.id))}
            className="shrink-0 hover:opacity-80 transition-opacity"
            aria-label="Close notification"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      ))}
    </div>
  );
}
