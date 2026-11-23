import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { api } from '../../src/api';
import { Button, ErrorBox, Page, Title, useAction, useUI } from '../../src/ui';
export default function MobileLink() {
  const { styles } = useUI();
  const { action, token, email, otp } = useLocalSearchParams<{ action: string; token?: string; email?: string; otp?: string }>(); const request = useAction(); const [done, setDone] = useState(false);
  return <Page><Title>{action === 'reset' ? 'Şifreni sıfırla.' : 'E-postanı doğrula.'}</Title>{done ? <><Text style={styles.text}>E-postan doğrulandı.</Text><Button title="Giriş yap" onPress={() => router.replace('/auth/login')}/></> : <Button busy={request.busy} title={action === 'reset' ? 'Yeni şifre belirle' : 'E-postamı doğrula'} onPress={() => {
    if (action === 'reset') router.replace({ pathname: '/auth/reset', params: { token, email, otp } });
    else request.run(async () => { await api('/mobile/verify-email', 'POST', { token }); setDone(true); });
  }}/>}<ErrorBox error={request.error}/></Page>;
}
