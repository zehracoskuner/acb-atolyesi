import { notificationTarget } from "../lib/notificationTarget";
import "../styles/NotificationContext.css";
export default function NotificationContext({ notification }) {
  const target = notificationTarget(notification);
  if (!target) return null;
  return <div className="notification-context">
    {target.label && <span className="notification-context-label">{target.label}</span>}
    {target.title && <span className="notification-context-title">{target.title}</span>}
    <span className="notification-context-action">{target.action} <span aria-hidden="true">↗</span></span>
  </div>;
}
