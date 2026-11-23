import { router, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useSession } from '../session';
import { Button, Page, Title } from '../ui';
let destination: Href | null = null;
export function joinAtelier(returnTo?: Href, mode: 'login' | 'register' = 'login') { destination = returnTo || null; router.push(`/auth/${mode}`); }
export function afterLogin(): Href { const next = destination || '/(tabs)'; destination = null; return next; }
export function MemberGate({ children, title, returnTo }: PropsWithChildren<{ title: string; returnTo?: Href }>) {
  const { user } = useSession();
  return user ? children : <Page><Title description="Bu alanı kullanmak için hesabına giriş yap.">{title}</Title><Button title="Aramıza katıl :)" onPress={() => joinAtelier(returnTo)}/></Page>;
}
