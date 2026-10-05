import { useId } from "react";
import { Link } from "react-router-dom";
import { TERMS_VERSION, TERMS_PATH, ETHICS_PATH } from "../lib/terms";
import "../styles/TermsAcceptance.css";

export default function TermsAcceptance({ checked, onChange, disabled = false }) {
  const id = useId();
  return (
    <div className="terms-acceptance">
      <div className="terms-acceptance-row">
        <input id={id} name="termsAccepted" type="checkbox" required
          checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
        <label htmlFor={id}>
          <Link to={TERMS_PATH} target="_blank" rel="noopener noreferrer">Kullanıcı Sözleşmesi</Link>'ni
          ve kapsamındaki <Link to={ETHICS_PATH} target="_blank" rel="noopener noreferrer">Etik Kurallar</Link>'ı
          okudum, kabul ediyorum. (Zorunlu)
        </label>
      </div>
      <p>Üyelik için açık kabul bu kutuyla alınır; yalnızca kayıt veya giriş yapmak yeterli değildir.</p>
      <p>Sürüm: {TERMS_VERSION}. Eser sahipliği eki hukuk incelemesi bekleyen taslaktır.</p>
      <p>Bu kabul reklam veya pazarlama iletisi izni değildir. <Link to="/gizlilik" target="_blank" rel="noopener noreferrer">Gizlilik Politikası</Link>.</p>
    </div>
  );
}
