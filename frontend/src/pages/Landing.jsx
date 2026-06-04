import TopBar from "../components/TopBar";
import "../styles/ui.css";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import "../styles/AppEditor.css";


export default function Landing(){
  return (
    <div className="container-page">
      <TopBar/>
      <main className="main-wrap">
        <div className="hero">
          <div className="left">
            <div className="muted">📚 Keşfet</div>
            <h1>Okuma Modu</h1>
            <p>Hikâyeler, denemeler ve e-kitaplar — rahatça keşfet.</p>
            <div style={{display:"flex",gap:10,marginTop:150,alignItems:"center"}}>
              <Link to="/keşfet" className="btn">📖 Okuma Moduna Gir</Link>
            </div>
          </div>
          <div className="right" style={{background:"linear-gradient(135deg,#fff,#fff5f5)"}}>
            <div className="muted">◇ Oluştur</div>
            <h1>Yazma Modu</h1>
            <p>İlham bul, taslak oluştur, paylaş. Yeni başlayanlar için destekli akış.</p>
            <div style={{display:"flex",gap:10,marginTop:150,alignItems:"center"}}>
              <Link to="/yazma" className="btn">✍️ Yazmaya Başla</Link>
              <span className="muted">✨ İlham Prompts</span>
            </div>
          </div>
        </div>
        <Footer/>
      </main>
    </div>
  );
}
