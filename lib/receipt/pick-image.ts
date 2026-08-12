import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

export type ReceiptImagePickSource = 'camera' | 'library';

export async function pickReceiptImage(
  source: ReceiptImagePickSource,
): Promise<{ uri: string | null; error: string | null; cancelled: boolean }> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        return {
          uri: null,
          cancelled: false,
          error: 'Camera access is disabled. Enable it in Settings to scan receipts.',
        };
      }
      return { uri: null, cancelled: false, error: 'Camera permission is required to scan receipts.' };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled) {
      return { uri: null, cancelled: true, error: null };
    }

    return { uri: result.assets[0]?.uri ?? null, cancelled: false, error: null };
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    if (!permission.canAskAgain) {
      return {
        uri: null,
        cancelled: false,
        error: 'Photo library access is disabled. Enable it in Settings to upload receipts.',
      };
    }
    return { uri: null, cancelled: false, error: 'Photo access is required to choose a receipt.' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  });

  if (result.canceled) {
    return { uri: null, cancelled: true, error: null };
  }

  return { uri: result.assets[0]?.uri ?? null, cancelled: false, error: null };
}

export function showPermissionSettingsAlert(message: string) {
  Alert.alert('Permission needed', message, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Open Settings',
      onPress: () => {
        if (Platform.OS === 'ios') {
          void Linking.openURL('app-settings:');
        } else {
          void Linking.openSettings();
        }
      },
    },
  ]);
}
