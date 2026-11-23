import { Redirect } from 'expo-router';
import { useSession } from '../src/session';
export default function Index() { const { user } = useSession(); return <Redirect href={!user ? '/auth/welcome' : !user.profileComplete || user.requiresTermsAcceptance ? '/auth/complete' : '/(tabs)'}/>; }
