import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import "../styles/WorkReadPage.css";

export default function WorkReadPage() {
  const { workId } = useParams();
  const navigate = useNavigate();

  const [work, setWork] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    const loadWork = async () => {
      try {
        setLoading(true);
        const [workRes, chaptersRes] = await Promise.all([
          apiGet(`/works/${workId}`),
          apiGet(`/works/${workId}/chapters/published`),
        ]);

        setWork(workRes.item);
        setChapters(chaptersRes.items || []);
        
        // View sayısını artır
        apiPost(`/works/${workId}/view`).catch(() => {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadWork();
  }, [workId]);

  const currentChapter = chapters[currentChapterIndex];

  const handleLike = async () => {
    try {
      await apiPost(`/works/${workId}/like`);
      setLiked(!liked);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookmark = async () => {
    try {
      await apiPost(`/works/${workId}/bookmark`);
      setBookmarked(!bookmarked);
    } catch (err) {
      console.error(err);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await apiPost(`/works/${workId}/comments`, { content: newComment });
      setNewComment("");
      // Yorumları yeniden yükle
      const commentsRes = await apiGet(`/works/${workId}/comments`);
      setComments(commentsRes.items || []);
    } catch (err) {
      console.error(err);
    }
  };

  const nextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <div className="read-loading">
        <div className="read-spinner" />
      </div>
    );
  }

  if (!work || !currentChapter) {
    return (
      <div className="read-error">
        <p>Hikaye bulunamadı</p>
        <button onClick={() => navigate("/explore")}>Keşfet Sayfasına Dön</button>
      </div>
    );
  }

  return (
    <div className="read-page">
      {/* Header */}
      <header className="read-header">
        <button className="read-back" onClick={() => navigate("/explore")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Geri
        </button>

        <div className="read-header-info">
          <h1 className="read-title">{work.title}</h1>
          <p className="read-author">
            {work.isAnonymous ? "Anonim Yazar" : work.author?.username || "Yazar"}
          </p>
        </div>

        <div className="read-actions">
          <button
            className={`read-action-btn ${liked ? "active" : ""}`}
            onClick={handleLike}
            title="Beğen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          <button
            className={`read-action-btn ${bookmarked ? "active" : ""}`}
            onClick={handleBookmark}
            title="Favorilere Ekle"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>

          <button
            className="read-action-btn"
            onClick={() => setShowComments(!showComments)}
            title="Yorumlar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Önsöz */}
      {work.preface && currentChapterIndex === 0 && (
        <div className="read-preface">
          <h3>Yazardan Notlar</h3>
          <p>{work.preface}</p>
        </div>
      )}

      {/* Bölüm Navigasyonu */}
      <div className="read-chapter-nav">
        <select
          value={currentChapterIndex}
          onChange={(e) => setCurrentChapterIndex(Number(e.target.value))}
          className="read-chapter-select"
        >
          {chapters.map((ch, idx) => (
            <option key={ch._id} value={idx}>
              Bölüm {idx + 1}: {ch.title}
            </option>
          ))}
        </select>
      </div>

      {/* Bölüm İçeriği */}
      <article className="read-content">
        <h2 className="read-chapter-title">
          Bölüm {currentChapterIndex + 1}: {currentChapter.title}
        </h2>
        
        <div className="read-chapter-body">
          {currentChapter.content.split('\n').map((paragraph, idx) => (
            paragraph.trim() && <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </article>

      {/* Bölüm Navigasyon Butonları */}
      <div className="read-pagination">
        <button
          className="read-nav-btn"
          onClick={prevChapter}
          disabled={currentChapterIndex === 0}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Önceki Bölüm
        </button>

        <span className="read-chapter-indicator">
          {currentChapterIndex + 1} / {chapters.length}
        </span>

        <button
          className="read-nav-btn"
          onClick={nextChapter}
          disabled={currentChapterIndex === chapters.length - 1}
        >
          Sonraki Bölüm
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Yorumlar */}
      {showComments && (
        <div className="read-comments">
          <h3>Yorumlar ({comments.length})</h3>
          
          <form className="read-comment-form" onSubmit={handleComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Düşüncelerini paylaş..."
              rows={3}
            />
            <button type="submit">Yorum Yap</button>
          </form>

          <div className="read-comments-list">
            {comments.map((comment) => (
              <div key={comment._id} className="read-comment">
                <div className="read-comment-header">
                  <strong>{comment.user.username}</strong>
                  <span>{new Date(comment.createdAt).toLocaleDateString("tr-TR")}</span>
                </div>
                <p>{comment.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}