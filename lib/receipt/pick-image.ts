import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

export type ReceiptImagePickSource = 'camera' | 'library';

export type ReceiptImagePickResult = {
  uri: string | null;
  base64: string | null;
  error: string | null;
  cancelled: boolean;
};

export async function pickReceiptImage(
  source: ReceiptImagePickSource,
): Promise<ReceiptImagePickResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        return {
          uri: null,
          base64: null,
          cancelled: false,
          error: 'Camera access is disabled. Enable it in Settings to scan receipts.',
        };
      }
      return {
        uri: null,
        base64: null,
        cancelled: false,
        error: 'Camera permission is required to scan receipts.',
      };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
      base64: true,
    });

    if (result.canceled) {
      return { uri: null, base64: null, cancelled: true, error: null };
    }

    const asset = result.assets[0];
    return {
      uri: asset?.uri ?? null,
      base64: asset?.base64 ?? null,
      cancelled: false,
      error: asset?.base64 ? null : 'Could not read the receipt image data.',
    };
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    if (!permission.canAskAgain) {
      return {
        uri: null,
        base64: null,
        cancelled: false,
        error: 'Photo library access is disabled. Enable it in Settings to upload receipts.',
      };
    }
    return {
      uri: null,
      base64: null,
      cancelled: false,
      error: 'Photo access is required to choose a receipt.',
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
    base64: true,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });

  if (result.canceled) {
    return { uri: null, base64: null, cancelled: true, error: null };
  }

  const asset = result.assets[0];
  return {
    uri: asset?.uri ?? null,
    base64: asset?.base64 ?? null,
    cancelled: false,
    error: asset?.base64 ? null : 'Could not read the receipt image data.',
  };
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
