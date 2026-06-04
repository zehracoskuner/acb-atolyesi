import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyReadingProgress } from '../../services/readingProgressService';
import styles from './ContinueReading.module.css';

const ContinueReading = () => {
  const [progressList, setProgressList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const data = await getMyReadingProgress();
        setProgressList(data.slice(0, 5)); // Son 5 okuma
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, []);

  if (loading) return <div className={styles.skeleton} />;
  if (progressList.length === 0) return null; // Empty state Aşama 3'te

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Kaldığın Yerden Devam Et</h2>
      <div className={styles.grid}>
        {progressList.map(({ story, chapter, updatedAt }) => (
          <Link
            key={story._id}
            to={`/story/${story.slug}/chapter/${chapter._id}`}
            className={styles.card}
          >
            <img
              src={story.coverImage}
              alt={story.title}
              className={styles.cover}
            />
            <div className={styles.info}>
              <p className={styles.storyTitle}>{story.title}</p>
              <p className={styles.chapterLabel}>
                Bölüm {chapter.chapterNumber}: {chapter.title}
              </p>
              <p className={styles.date}>
                {new Date(updatedAt).toLocaleDateString('tr-TR')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default ContinueReading;