import ReportActions from './ReportActions';
export default function ImageReportButton({ kind, targetId, url, label }) {
  if (!url) return null;
  return <ReportActions targetType={kind} targetId={targetId} image={{ kind, url, label }} />;
}
