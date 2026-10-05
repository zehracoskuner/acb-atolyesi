import { useParams } from "react-router-dom";
import NotesWorkspace from "../components/NotesWorkspace";
import "../styles/WorkNotes.css";
export default function WorkNotesPage() {
  const { workId } = useParams();
  return <NotesWorkspace key={workId} workId={workId} />;
}
