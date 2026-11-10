import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Renders HTML to a PDF and opens the share sheet (WhatsApp, email, Files…). On web: print dialog. */
export async function sharePdf(html: string, fileTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileTitle });
  } else {
    await Print.printAsync({ uri });
  }
}
