// src/pages/StudioHub.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { apiGet, apiDelete } from "../lib/api";
import CreateWorkModal from "../components/CreateWorkModal";
import EditWorkModal from "../components/EditWorkModal";
import "../styles/StudioHub.css";

// Eser ID'sini güvenle al — backend bazen _id, bazen id döner
const getId = (w) => w?._id || w?.id;

export default function StudioHub() {
  const navigate = useNavigate();
  const [works,   setWorks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  /* CreateWorkModal */
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  /* EditWorkModal */
  const [isEditOpen,  setIsEditOpen]  = useState(false);
  const [editingWork, setEditingWork] = useState(null);

  /* ── Eserleri yükle ── */
  useEffect(() => {
    apiGet("/works")
      .then((data) => {
        setWorks(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Eserler yüklenemedi:", err);
        setError("Çalışmalar yüklenirken bir hata oluştu.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
  window.__acbOpenCreateModal = () => setIsCreateOpen(true);
  return () => { delete window.__acbOpenCreateModal; };
}, []);

  /* ── Eser sil ── */
  const handleDeleteWork = async (e, workId) => {
    e.stopPropagation();
    if (!window.confirm("Bu eseri kalıcı olarak silmek istediğine emin misin? Tüm bölümler de silinecek.")) {
      return;
    }
    try {
      await apiDelete(`/works/${workId}`);
      setWorks((prev) => prev.filter((w) => getId(w) !== workId));
    } catch (err) {
      alert("Eser silinemedi.");
      console.error(err);
    }
  };

  /* ── Eser düzenle: modal aç ── */
  const handleEditWork = (e, work) => {
    e.stopPropagation();
    setEditingWork(work);
    setIsEditOpen(true);
  };

  /* ── Eser düzenle: başarı ── */
  // onSuccess prop'u zaten onClose'u da tetiklemediği için burada sadece state güncelleniyor.
  // Modal kapanması EditWorkModal'ın kendi içinde gerçekleşir; biz sadece listeyi güncelliyoruz.
  const handleEditSuccess = (updatedWork) => {
    setWorks((prev) =>
      prev.map((w) => getId(w) === getId(updatedWork) ? updatedWork : w)
    );
    // isEditOpen ve editingWork'ü burada sıfırlamıyoruz —
    // EditWorkModal zaten onClose'u kendi çağırıyor (setTimeout sonrası).
  };

  const handleEditClose = () => {
    setIsEditOpen(false);
    setEditingWork(null);
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="studio-splash">
      <div className="studio-splash-ring" />
      <span>Atölye Yükleniyor…</span>
    </div>
  );

  return (
    <div className="studio-root">
      <TopBar />

      <main className="studio-main">

        <div className="studio-tab-content">
            <div className="studio-header">
              <h2>Çalışmalarım</h2>
              <button
                className="studio-btn-new"
                onClick={() => setIsCreateOpen(true)}
              >
                + Yeni Eser Oluştur
              </button>
            </div>

            {error && <div className="studio-error">{error}</div>}

            {works.length === 0 && !error ? (
              <div className="studio-empty">
                <span className="studio-empty-icon">✍️</span>
                <p>Henüz hiç çalışman yok. Yeni bir eser oluşturarak maceraya başla!</p>
              </div>
            ) : (
              <div className="studio-grid">
                {works.map((work, index) => {
                  const workId = getId(work);
                  return (
                    <div
                      key={workId}
                      className="studio-work-card"
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => navigate(`/work/${workId}`)}
                    >
                      <div className="studio-work-cover">
                        {work.coverImage ? (
                          <img src={work.coverImage} alt={work.title} />
                        ) : (
                          <div className="studio-work-placeholder">
                            <div className="studio-work-pattern" />
                            <span className="studio-work-initials">
                              {work.title?.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className={`studio-work-status ${work.status === "published" ? "published" : "draft"}`}>
                          {work.status === "published" ? "Yayında" : "Taslak"}
                        </span>
                      </div>

                      <h3 className="studio-work-title">{work.title}</h3>

                      <div className="studio-work-meta">
                        <div>
                          <span>{new Date(work.updatedAt).toLocaleDateString("tr-TR")}</span>
                          <span className="studio-meta-sep">·</span>
                          <button
                            className="studio-btn-edit-inline"
                            onClick={(e) => handleEditWork(e, work)}
                            title="Eseri Düzenle"
                          >
                            Düzenle ✎
                          </button>
                        </div>
                        <button
                          className="studio-btn-delete"
                          onClick={(e) => handleDeleteWork(e, workId)}
                          title="Eseri Sil"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

      </main>

      {/* ── Yeni Eser Modal ── */}
      <CreateWorkModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(newWork) => {
          navigate(`/work/${getId(newWork)}`);
        }}
      />

      {/* ── Eser Düzenleme Modal ── */}
      <EditWorkModal
        isOpen={isEditOpen}
        onClose={handleEditClose}
        work={editingWork}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}