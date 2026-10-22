import { Navigate, useParams } from "react-router-dom";
// Keep old notification links usable without requiring a separate detail API.
export default function LogDetail() {
  const { id } = useParams();
  return <Navigate replace to={'/profile/me?tab=log&log=' + encodeURIComponent(id)} />;
}
