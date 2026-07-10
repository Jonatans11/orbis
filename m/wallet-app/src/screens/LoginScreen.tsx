import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import type { SocialProvider } from '@/services/auth';
import { signInWithProvider } from '@/services/auth';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ route }: Props) {
  const initialMode = route.params?.mode ?? 'login';
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await signUp(email.trim(), password, name.trim() || undefined);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      Alert.alert(
        mode === 'register' ? 'Registration failed' : 'Sign-in failed',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: SocialProvider) => {
    try {
      await signInWithProvider(provider);
    } catch (err) {
      Alert.alert('Not available yet', err instanceof Error ? err.message : 'Coming soon.');
    }
  };

  return (
    <Screen withBottomInset>
      <Text style={styles.title}>
        {mode === 'register' ? 'Create your ORBIS.ID' : 'Welcome back'}
      </Text>
      <Text style={styles.subtitle}>
        {mode === 'register'
          ? 'Your keys are generated on this device and never leave it.'
          : 'Sign in to unlock your wallet.'}
      </Text>

      <View style={styles.form}>
        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button
          title={mode === 'register' ? 'Create identity' : 'Sign in'}
          onPress={submit}
          loading={busy}
        />
      </View>

      <Text style={styles.divider}>or continue with</Text>
      <View style={styles.socialRow}>
        <Button title="Google" variant="secondary" style={styles.socialBtn} onPress={() => social('google')} />
        <Button title="Apple" variant="secondary" style={styles.socialBtn} onPress={() => social('apple')} />
        <Button title="Microsoft" variant="secondary" style={styles.socialBtn} onPress={() => social('microsoft')} />
      </View>

      <Button
        title={mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create your ORBIS.ID'}
        variant="ghost"
        onPress={() => setMode(mode === 'register' ? 'login' : 'register')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    marginTop: spacing[6],
  },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing[2] },
  form: { gap: spacing[3], marginTop: spacing[6] },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: fontSize.base,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 52,
  },
  divider: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginVertical: spacing[5],
  },
  socialRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  socialBtn: { flex: 1 },
});
