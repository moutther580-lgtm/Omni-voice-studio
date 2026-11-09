import JSZip from 'jszip';
import { KOTLIN_SOURCE_FILES } from '../data/androidSourceKotlin';
import { JAVA_SOURCE_FILES } from '../data/androidSourceJava';
import { CONFIG_SOURCE_FILES } from '../data/androidProjectConfig';
import { FIREBASE_SOURCE_FILES } from '../data/androidFirebaseSource';

export async function generateAndroidStudioProjectZip(language: 'all' | 'kotlin' | 'java' = 'all'): Promise<Blob> {
  const zip = new JSZip();

  // Root README
  zip.file(
    'README.md',
    `# OmniVoice Studio — Production Android Studio Release
Package: com.omnivoice.studio
Target SDK: 35 (Android 15 Ready)
Architecture: Kotlin Coroutines + Java 17 + Firebase Auth & Firestore + MediaCodec M4A

Features:
- Pure text processing and hierarchical chunking with Urdu (۔) and Arabic (؟) sentence splitting.
- Multi-key rotation pool with rate-limit (429) cooldown tracking.
- Audio synthesis supporting Gemini 3.8+ AUDIO modalities and speech_metadata.
- Hardware MediaCodec AAC/M4A encoder with MediaMuxer container.
- Foreground service with WakeLock and notification progress.
- Screen-reader accessible UI (TalkBack, Jieshuo) developed for the blind community by Moutter Rasool.
- Firebase Authentication & Firestore User Credit synchronization.

How to Build .AAB for Google Play Store:
See PlayStore_Release_Guide.md for exact build and signing instructions:
$ ./gradlew bundleRelease
`
  );

  // Common Config & Resources
  for (const file of CONFIG_SOURCE_FILES) {
    zip.file(file.path, file.code);
  }

  // Firebase Source Files & PlayStore Guide
  for (const file of FIREBASE_SOURCE_FILES) {
    zip.file(file.path, file.code);
  }

  // Android google-services.json
  const googleServicesJson = {
    project_info: {
      project_number: "540203684709",
      project_id: "gen-lang-client-0266510215",
      storage_bucket: "gen-lang-client-0266510215.firebasestorage.app"
    },
    client: [
      {
        client_info: {
          mobilesdk_app_id: "1:540203684709:android:be9c77e28b19e9c09a478c",
          android_client_info: {
            package_name: "com.gemini.tts"
          }
        },
        oauth_client: [],
        api_key: [
          {
            current_key: "AIzaSyAmebXkJagVVyoWEp3bYlccNrKazE88Aho"
          }
        ],
        services: {
          appinvite_service: {
            other_platform_oauth_client: []
          }
        }
      }
    ],
    configuration_version: "1"
  };
  zip.file('app/google-services.json', JSON.stringify(googleServicesJson, null, 2));

  // Kotlin files
  if (language === 'all' || language === 'kotlin') {
    for (const file of KOTLIN_SOURCE_FILES) {
      zip.file(file.path, file.code);
    }
  }

  // Java files
  if (language === 'all' || language === 'java') {
    for (const file of JAVA_SOURCE_FILES) {
      zip.file(file.path, file.code);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}
