import { useParams } from "react-router-dom";
import NotesWorkspace from "../components/NotesWorkspace";
import WorkNotesView from "../components/WorkNotesView";
export default function WorkNotesPage() {
  const { workId } = useParams();
  return <NotesWorkspace key={workId} workId={workId} WorkView={WorkNotesView} />;
}
