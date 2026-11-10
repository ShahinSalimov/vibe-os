import { Platform } from 'react-native';
import { newId } from '../lib/id';

// Audio files live in the app's private documents folder: survive restarts, removed with the app.
// On web (testing only) the original URI is kept.

export function keepAudioFile(srcUri: string, nameHint = 'audio.m4a'): Promise<string> {
  return keepFile(srcUri, nameHint, 'studio');
}

/** Copies a picked/recorded file into the app's private documents folder and returns the new URI. */
export async function keepFile(srcUri: string, nameHint: string, folder: string): Promise<string> {
  if (Platform.OS === 'web') return srcUri;
  const { Directory, File, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.document, folder);
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = (nameHint.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '.m4a').toLowerCase();
  const dest = new File(dir, `${newId()}${ext}`);
  await new File(srcUri).copy(dest);
  return dest.uri;
}

export const removeFile = removeAudioFile;

export async function removeAudioFile(uri: string | null | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    const { File } = await import('expo-file-system');
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* already gone */
  }
}
