// Local UI fixture; never imported by the application.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ChapterMedia from "../src/components/ChapterMedia";
import ChapterMediaEditor from "../src/components/ChapterMediaEditor";
import "../src/styles/ChaptersPage.css";
export default function Fixture() {
  const [media, setMedia] = useState([]);
  return <main style={{ maxWidth: 700, margin: "24px auto", padding: 16 }}>
    <h1>Bölüm medyası önizlemesi</h1>
    <ChapterMediaEditor media={media} onChange={setMedia} onUploading={() => {}} />
    <h2>Okuyucu görünümü</h2><ChapterMedia media={media} />
  </main>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
