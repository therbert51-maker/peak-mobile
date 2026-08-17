import * as ImagePicker from 'expo-image-picker';

import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'profile-avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type AvatarPickSource = 'camera' | 'library';

type PickedAvatar = {
  base64: string | null;
  mimeType: string | null;
  cancelled: boolean;
  error: string | null;
};

function decodeBase64(base64: string): ArrayBuffer {
  const payload = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function pickProfileAvatar(source: AvatarPickSource): Promise<PickedAvatar> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return {
      base64: null,
      mimeType: null,
      cancelled: false,
      error: permission.canAskAgain
        ? `${source === 'camera' ? 'Camera' : 'Photo library'} permission is required.`
        : `${source === 'camera' ? 'Camera' : 'Photo library'} access is disabled in Settings.`,
    };
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
    ...(source === 'library'
      ? {
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        }
      : {}),
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) {
    return { base64: null, mimeType: null, cancelled: true, error: null };
  }

  const asset = result.assets[0];
  return {
    base64: asset?.base64 ?? null,
    mimeType: asset?.mimeType ?? 'image/jpeg',
    cancelled: false,
    error: asset?.base64 ? null : 'Could not read the selected photo.',
  };
}

export async function uploadProfileAvatar(input: {
  userId: string;
  base64: string;
  mimeType: string;
}): Promise<{ avatarUrl: string | null; error: string | null }> {
  const mimeType = input.mimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { avatarUrl: null, error: 'Choose a JPEG, PNG, or WebP image.' };
  }

  let imageBytes: ArrayBuffer;
  try {
    imageBytes = decodeBase64(input.base64);
  } catch {
    return { avatarUrl: null, error: 'Could not process the selected photo.' };
  }

  if (imageBytes.byteLength === 0 || imageBytes.byteLength > MAX_AVATAR_BYTES) {
    return { avatarUrl: null, error: 'Profile photos must be smaller than 5 MB.' };
  }

  const path = `${input.userId}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, imageBytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    return { avatarUrl: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: input.userId,
        avatar_url: avatarUrl,
      },
      { onConflict: 'id' },
    );

  if (profileError) {
    return { avatarUrl: null, error: formatSupabaseError(profileError) };
  }

  return { avatarUrl, error: null };
}
