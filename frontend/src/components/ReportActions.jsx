import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useMembership } from '../lib/membershipContext';
import { useSession } from '../lib/session';
import ReportModal from './ReportModal';
import './ReportActions.css';

export default function ReportActions({ targetType = 'work', targetId, targetLabel, image, targetOwner, isOwner = false }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(null);
  const root = useRef(null), trigger = useRef(null);
  const id = useId();
  const membership = useMembership();
  const session = useSession();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector('.report-actions-menu button')?.focus();
    const outside = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    const escape = e => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (session.status !== 'authenticated') return null;
  const ownerId = targetOwner?._id || targetOwner?.id || targetOwner;
  const userId = session.user?.id || session.user?._id;
  if (['work', 'chapter', 'cover'].includes(targetType) && (isOwner || (ownerId && userId && String(ownerId) === String(userId)))) return null;
  function choose(value) {
    if (membership && !membership.requireMember()) return;
    setOpen(false); setReport(value);
  }
  const content = targetType === 'work' || targetType === 'chapter';
  const buttonLabel = targetType === 'avatar' ? 'Profil fotoğrafı için bildirim seçenekleri' : targetType === 'banner' ? 'Banner için bildirim seçenekleri' : 'Şikâyet seçenekleri';
  return <div className="report-actions" ref={root} onBlur={e => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="report-actions-trigger" aria-label={buttonLabel}
      title={buttonLabel} aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}>
      <MoreHorizontal size={20} aria-hidden="true" />
    </button>
    {open && <div id={id} className="report-actions-menu" aria-label="Şikâyet seçenekleri">
      {content && <>
        <button type="button" onClick={() => choose({ targetType, targetId, targetLabel, initialReason: 'telif_ihlali' })}>Telif hakkı ihlali bildir</button>
        <button type="button" onClick={() => choose({ targetType, targetId, targetLabel, initialReason: 'uygunsuz_icerik' })}>Uygunsuz içerik bildir</button>
        <button type="button" onClick={() => choose({ targetType, targetId, targetLabel })}>Diğer şikâyetler</button>
      </>}
      {image?.url && <button type="button" onClick={() => choose({ targetType: image.kind, targetId: image.targetId || targetId, targetLabel: image.label || 'Görsel', expectedUrl: image.url })}>{image.label || 'Görseli şikâyet et'}</button>}
    </div>}
    {report && <ReportModal {...report} isOpen onClose={() => { setReport(null); trigger.current?.focus(); }} />}
  </div>;
}
