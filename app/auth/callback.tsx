import type { EmailOtpType } from '@supabase/supabase-js';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';
import { safeAuthDestination } from '@/lib/auth-navigation';
import { supabase } from '@/lib/supabase';

const OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'email_change',
  'invite',
  'magiclink',
  'recovery',
  'signup',
]);

function firstParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
    next?: string | string[];
    returnTo?: string | string[];
    error_description?: string | string[];
  }>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const completeAuth = async () => {
      const callbackError = firstParam(params.error_description);
      if (callbackError) {
        if (active) setErrorMessage(callbackError);
        return;
      }

      const code = firstParam(params.code);
      const tokenHash = firstParam(params.token_hash);
      const otpTypeValue = firstParam(params.type);
      let authError: Error | null = null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        authError = error;
      } else if (
        tokenHash &&
        otpTypeValue &&
        OTP_TYPES.has(otpTypeValue as EmailOtpType)
      ) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpTypeValue as EmailOtpType,
        });
        authError = error;
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          authError = new Error('This authentication link is invalid or incomplete.');
        }
      }

      if (!active) return;
      if (authError) {
        setErrorMessage(authError.message);
        return;
      }

      const next = firstParam(params.next);
      if (next === '/reset-password') {
        router.replace({
          pathname: '/reset-password',
          params: { next: safeAuthDestination(params.returnTo) },
        } as unknown as Href);
        return;
      }

      router.replace(safeAuthDestination(params.next) as Href);
    };

    void completeAuth();
    return () => {
      active = false;
    };
  }, [
    params.code,
    params.error_description,
    params.next,
    params.returnTo,
    params.token_hash,
    params.type,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      {errorMessage ? (
        <View style={styles.content}>
          <Text style={styles.title}>That link didn’t work</Text>
          <Text style={styles.message}>{errorMessage}</Text>
          <PeakButton title="Back to Log In" onPress={() => router.replace('/sign-in')} />
        </View>
      ) : (
        <View style={styles.content}>
          <ActivityIndicator size="large" color={PeakColors.primary} />
          <Text style={styles.message}>Securing your Peak session…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    ...Typography.h2,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    color: PeakColors.textSecondary,
    textAlign: 'center',
  },
});

