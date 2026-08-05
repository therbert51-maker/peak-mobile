import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';

export default function InspirationDetailsLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.authGate}>
        <ActivityIndicator size="large" color={PeakColors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.background,
  },
});
