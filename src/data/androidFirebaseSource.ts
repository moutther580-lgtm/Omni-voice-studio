/**
 * Native Android Firebase Authentication and Firestore synchronization classes (Kotlin & Java)
 * for Gemini TTS Converter Play Store release.
 */

import { SourceFile } from './androidSourceKotlin';

export const FIREBASE_SOURCE_FILES: SourceFile[] = [
  {
    name: "FirebaseAuthManager.kt",
    path: "app/src/main/kotlin/com/gemini/tts/firebase/FirebaseAuthManager.kt",
    package: "com.gemini.tts.firebase",
    language: "kotlin",
    description: "Handles Google One-Tap / Firebase Sign-In, user session persistence, and Firestore credit synchronization in Kotlin.",
    luaMapping: "User authentication & cloud session management",
    code: `package com.gemini.tts.firebase

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

data class UserProfile(
    val uid: String,
    val email: String,
    val displayName: String,
    val credits: Long = 10000L, // 10,000 welcome credits
    val tier: String = "Free"
)

/**
 * FirebaseAuthManager handles user login, token refresh,
 * and real-time Firestore credit synchronization for Google Play Store release.
 */
class FirebaseAuthManager(private val context: Context) {

    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()

    val currentUser: FirebaseUser?
        get() = auth.currentUser

    val isLoggedIn: Boolean
        get() = auth.currentUser != null

    /**
     * Initializes or loads user document from Firestore upon sign-in.
     */
    suspend fun getOrCreateUserProfile(): Result<UserProfile> {
        val user = auth.currentUser ?: return Result.failure(IllegalStateException("User is not signed in"))
        val userDocRef = firestore.collection("users").document(user.uid)

        return try {
            val snapshot = userDocRef.get().await()
            if (snapshot.exists()) {
                val profile = UserProfile(
                    uid = user.uid,
                    email = snapshot.getString("email") ?: user.email ?: "",
                    displayName = snapshot.getString("displayName") ?: user.displayName ?: "User",
                    credits = snapshot.getLong("credits") ?: 10000L,
                    tier = snapshot.getString("tier") ?: "Free"
                )
                Result.success(profile)
            } else {
                // First-time registration: Grant 10,000 welcome credits
                val newProfile = UserProfile(
                    uid = user.uid,
                    email = user.email ?: "",
                    displayName = user.displayName ?: "User",
                    credits = 10000L,
                    tier = "Free"
                )
                val initialData = hashMapOf(
                    "id" to user.uid,
                    "email" to (user.email ?: ""),
                    "displayName" to (user.displayName ?: "User"),
                    "credits" to 10000L,
                    "tier" to "Free",
                    "createdAt" to System.currentTimeMillis()
                )
                userDocRef.set(initialData).await()
                Result.success(newProfile)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Atomically deducts used characters from user's Firestore credit balance.
     */
    suspend fun deductCredits(charsUsed: Int): Result<Long> {
        val user = auth.currentUser ?: return Result.failure(IllegalStateException("User is not signed in"))
        val userDocRef = firestore.collection("users").document(user.uid)

        return try {
            val newBalance = firestore.runTransaction { transaction ->
                val snapshot = transaction.get(userDocRef)
                val currentCredits = snapshot.getLong("credits") ?: 10000L
                val updatedCredits = Math.max(0L, currentCredits - charsUsed)
                transaction.update(userDocRef, "credits", updatedCredits)
                updatedCredits
            }.await()
            Result.success(newBalance)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Records an audio conversion history item to Firestore subcollection.
     */
    suspend fun recordConversion(
        title: String,
        charsCount: Int,
        durationSec: Int,
        voice: String,
        model: String,
        format: String
    ): Result<Unit> {
        val user = auth.currentUser ?: return Result.failure(IllegalStateException("User not signed in"))
        val convRef = firestore.collection("users").document(user.uid).collection("conversions").document()

        val data = hashMapOf(
            "id" to convRef.id,
            "userId" to user.uid,
            "title" to title,
            "charsCount" to charsCount,
            "durationSec" to durationSec,
            "voice" to voice,
            "model" to model,
            "format" to format,
            "createdAt" to System.currentTimeMillis()
        )

        return try {
            convRef.set(data).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun signOut() {
        auth.signOut()
    }
}
`
  },
  {
    name: "PlayStoreBuildGuide.md",
    path: "PlayStore_Release_Guide.md",
    package: "docs",
    language: "java",
    description: "Complete step-by-step instructions for compiling .AAB (Android App Bundle) and .APK for Google Play Store upload.",
    luaMapping: "Release generation & Keystore signing documentation",
    code: `# Google Play Store Release Guide for Gemini TTS Converter

Follow these exact steps to compile your production .AAB (Android App Bundle) and publish to Google Play Store.

---

### Step 1: Create a Release Keystore (Digital Signature)
Run this command in terminal to create your official signing key:

\`\`\`bash
keytool -genkey -v -keystore release.keystore -alias geminitts -keyalg RSA -keysize 2048 -validity 10000
\`\`\`
Keep your keystore password safe; Google Play uses it to verify all future app updates.

---

### Step 2: Configure gradle.properties
In the root directory, open or create \`gradle.properties\` and add:

\`\`\`properties
MYAPP_RELEASE_STORE_FILE=release.keystore
MYAPP_RELEASE_KEY_ALIAS=geminitts
MYAPP_RELEASE_STORE_PASSWORD=your_keystore_password
MYAPP_RELEASE_KEY_PASSWORD=your_key_password
\`\`\`

---

### Step 3: Build the Android App Bundle (.AAB)
To generate the release bundle required by Google Play Console:

\`\`\`bash
# On Linux / macOS:
./gradlew bundleRelease

# On Windows:
gradlew.bat bundleRelease
\`\`\`

The generated file will be located at:
\`\`\`
app/build/outputs/bundle/release/app-release.aab
\`\`\`

---

### Step 4: Build Direct Standalone APK for Testing (Optional)
If you want to test the APK directly on your Android phone before uploading:

\`\`\`bash
./gradlew assembleRelease
\`\`\`
Output APK will be at:
\`\`\`
app/build/outputs/apk/release/app-release.apk
\`\`\`

---

### Step 5: Upload to Google Play Console
1. Open [Google Play Console](https://play.google.com/console).
2. Click **Create App** -> Name: **OmniVoice: Pro Speech & Audio** -> Category: **Tools / Audio Production**.
3. Go to **Release** -> **Production** (or Closed / Internal Testing).
4. Drag and drop \`app-release.aab\`.
5. Enter release notes: *"Initial production release with OmniVoice Speech Engine, 40+ languages, emotional cadence, Urdu & Arabic punctuation splitting, and hardware M4A/WAV encoding."*
6. Click **Review & Rollout**!
`
  }
];
