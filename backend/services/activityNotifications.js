import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { canReadMature } from './matureAccess.js';

async function followers(author, session = null) {
  return User.find({ following: author, _id: { $ne: author }, role: { $ne: 'banned' } })
    .select('_id birthYear').session(session).lean();
}

export async function notifyNewLog(log) {
  if (!['public', 'followers'].includes(log.visibility)) return;
  const recipients = await followers(log.author);
  if (!recipients.length) return;
  await Notification.insertMany(recipients.map(user => ({
    recipient: user._id, sender: log.author, type: 'new_log', log: log._id,
    text: 'Takip ettiğin bir yazar yeni bir günlük girdisi paylaştı.',
  })));
}

// Called inside the publication transaction, before the first publication is saved.
export async function notifyNewChapter(chapter, work, session) {
  if (chapter.status !== 'published' || chapter.firstPublishedAt || chapter.$locals?.previouslyPublished || work.isAnonymous) return;
  const recipients = (await followers(work.user, session))
    .filter(user => !work.contentWarning || canReadMature(user));
  if (!recipients.length) return;
  await Notification.insertMany(recipients.map(user => ({
    recipient: user._id, sender: work.user, type: 'new_chapter', work: work._id, chapter: chapter._id,
    text: 'Takip ettiğin bir yazar yeni bir bölüm yayınladı.',
  })), { session });
}

export async function notifyNewRegistration(user) {
  const admins = await User.find({ role: 'admin', _id: { $ne: user._id } }).select('_id').lean();
  if (!admins.length) return;
  await Notification.insertMany(admins.map(admin => ({
    recipient: admin._id, sender: user._id, type: 'new_registration',
    text: `${user.kullaniciAdi || 'Yeni bir kullanıcı'} atölyeye kayıt oldu.`,
  })));
}
