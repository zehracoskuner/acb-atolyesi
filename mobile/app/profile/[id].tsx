import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '../../src/components/ProfileScreen';
export default function Profile() { const { id } = useLocalSearchParams<{ id: string }>(); return <ProfileScreen key={id} id={id}/>; }
