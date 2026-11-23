import { message } from './api';
import NetInfo from '@react-native-community/netinfo';

export interface SyncIssue {
  kind: 'chapter' | 'reading' | 'storage';
  id: string;
  label: string;
  message: string;
  status?: number;
}
export interface SyncReport { issues: SyncIssue[]; stopped: boolean }

export function syncIssue(kind: SyncIssue['kind'], id: string, label: string, error: unknown): SyncIssue {
  const status = (error as { status?: number } | null)?.status;
  return { kind, id, label, status, message: message(error) };
}

export async function stopsSync(error: unknown) {
  const value = error as { status?: number; body?: { code?: string } } | null;
  if (value?.status === 0) {
    // A single timed-out request need not mean the whole device is offline.
    const network = await NetInfo.fetch().catch(() => null);
    return network?.isConnected === false || network?.isInternetReachable === false;
  }
  return value?.status === 401 ||
    ['PROFILE_INCOMPLETE', 'TERMS_ACCEPTANCE_REQUIRED'].includes(value?.body?.code || '');
}

export class SyncBatchError extends Error {
  constructor(public issues: SyncIssue[], public stopped: boolean) {
    super(issues.length ? `${issues.length} kayıt eşitlenemedi. ${issues.map(issue => `${issue.label}: ${issue.message}`).join('\n')}` : 'Oturum değiştiği için eşitleme durduruldu.');
  }
}
