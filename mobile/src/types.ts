export interface User {
  _id: string; kullaniciAdi: string; email: string; avatarUrl?: string;
  profileComplete: boolean; canChooseUsername?: boolean; requiresTermsAcceptance?: boolean; currentTermsVersion?: string;
  birthYear?: number; bio?: string; location?: string; website?: string; authProvider?: string; hasPassword?: boolean; bannerImage?: string;
}
export interface Work {
  isAnonymous?: boolean;
  _id: string; title: string; description?: string; preface?: string; coverImage?: string;
  status?: string; chapterCount?: number; contentWarning?: boolean; isOwner?: boolean;
  updatedAt?: string; pendingReviewCount?: number; rejectedCount?: number; unpublishedChangesCount?: number;
  genres?: string[]; universe?: { genres?: string[]; tone?: string; rules?: string; themes?: string };
  author?: { _id?: string; kullaniciAdi?: string; username?: string }; likeCount?: number;
}
export interface Chapter {
  _id: string; work?: string; title: string; content: string; revision: number;
  order?: number; status?: string; savedAt?: string; hasUnpublishedChanges?: boolean; reviewNote?: string;
  reviewStatus?: string;
}
export interface FeedItem {
  _id: string; type: 'log' | 'chapter'; content?: string; createdAt: string;
  author?: { _id: string; kullaniciAdi: string; avatarUrl?: string };
  work?: Work; relatedWork?: Work; chapter?: Chapter; likeCount: number; likedByMe: boolean;
  visibility?: 'public' | 'followers' | 'private'; commentCount?: number; publicationDateEstimated?: boolean;
}
export interface Comment {
  _id: string; content: string; author?: { _id: string; kullaniciAdi: string; avatarUrl?: string };
  likeCount?: number; isLiked?: boolean; replies?: Comment[]; isDeleted?: boolean;
  createdAt?: string; updatedAt?: string; isEdited?: boolean; status?: string;
}
export interface Scene {
  _id: string; title: string; description: string; goal: string; act: string; order: number;
  status: string; draftText?: string; characters?: Character[]; volume?: string;
  connections?: { target: string; edgeType: string }[];
  isAlternative?: boolean; time?: string; chapter?: string; position?: { x: number; y: number };
}
export interface Character { _id: string; name: string; color?: string; role?: string; notes?: string; tagline?: string; faction?: string; location?: string; status?: string }
export interface Entry { _id: string; name: string; description: string; notes: string }
export interface World { structure?: { templateId?: string; acts: { id: string; label: string; color?: string; roman?: string }[] }; locations: Entry[]; timeline: Entry[]; rules: Entry[]; notes: Entry[] }
export interface Note { _id: string; title: string; content?: string; body?: string; workId?: string }
export interface Progress { story: Work; chapter: Chapter; scrollPosition: number }
export interface MobileConfig {
  termsVersion: string; legal: { id: string; title: string; sections: { title: string; content: string }[] }[];
  features: { chapterHistory: boolean };
}
