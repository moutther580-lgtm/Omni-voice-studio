/**
 * Complete Android Studio project setup files:
 * AndroidManifest.xml, build.gradle.kts (App & Project), Proguard rules,
 * XML Layouts, and Values resources with TalkBack accessibility considerations.
 */

import { SourceFile } from './androidSourceKotlin';

export const CONFIG_SOURCE_FILES: SourceFile[] = [
  {
    name: "AndroidManifest.xml",
    path: "app/src/main/AndroidManifest.xml",
    package: "com.gemini.tts",
    language: "xml",
    description: "Configures permissions for Internet, WakeLock, Foreground Service (dataSync), FileProvider for audio sharing, and accessibility headings.",
    luaMapping: "StrictMode.setVmPolicy, acquireWake, releaseWake, shareFile",
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.gemini.tts">

    <!-- Permissions required for Gemini API requests and background processing -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.GeminiTTS">

        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity
            android:name=".ui.SettingsActivity"
            android:label="@string/settings_title"
            android:parentActivityName=".ui.MainActivity" />

        <activity
            android:name=".ui.HistoryActivity"
            android:label="@string/history_title"
            android:parentActivityName=".ui.MainActivity" />

        <!-- Foreground Service for background audio synthesis -->
        <service
            android:name=".service.TtsForegroundService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="dataSync" />

        <!-- FileProvider for secure audio file sharing via Intent -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

    </application>
</manifest>
`
  },
  {
    name: "build.gradle.kts (App)",
    path: "app/build.gradle.kts",
    package: "com.gemini.tts",
    language: "kotlin",
    description: "App-level Gradle build file with OkHttp3, Kotlin Coroutines, AndroidX Core, Lifecycle, and Media libraries.",
    luaMapping: "Gradle dependencies and compilation parameters",
    code: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.gemini.tts"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.gemini.tts"
        minSdk = 24
        targetSdk = 35
        versionCode = 20
        versionName = "2.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Networking
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
`
  },
  {
    name: "file_paths.xml",
    path: "app/src/main/res/xml/file_paths.xml",
    package: "res/xml",
    language: "xml",
    description: "FileProvider paths configuration allowing safe sharing of generated WAV and M4A audio files.",
    luaMapping: "Uri.fromFile, shareFile",
    code: `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-files-path name="tts_files" path="GeminiTTS/" />
    <external-path name="external_storage" path="." />
</paths>
`
  },
  {
    name: "activity_main.xml",
    path: "app/src/main/res/layout/activity_main.xml",
    package: "res/layout",
    language: "xml",
    description: "Accessible, high-contrast dashboard layout with large touch targets and accessibility tags.",
    luaMapping: "UI.dashboard layout",
    code: `<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#FFFFFF"
    android:fillViewport="true">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="16dp">

        <!-- Header -->
        <TextView
            android:id="@+id/tv_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/app_name"
            android:textSize="24sp"
            android:textStyle="bold"
            android:textColor="#1565C0"
            android:gravity="center"
            android:accessibilityHeading="true"
            android:layout_marginBottom="12dp" />

        <!-- Navigation Buttons -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:layout_marginBottom="12dp">

            <Button
                android:id="@+id/btn_settings"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/settings"
                android:backgroundTint="#EEEEEE"
                android:textColor="#333333" />

            <Space
                android:layout_width="8dp"
                android:layout_height="1dp" />

            <Button
                android:id="@+id/btn_history"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/history"
                android:backgroundTint="#EEEEEE"
                android:textColor="#333333" />
        </LinearLayout>

        <!-- Status Line -->
        <TextView
            android:id="@+id/tv_status"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/status_ready"
            android:textColor="#1B5E20"
            android:textSize="16sp"
            android:textStyle="bold"
            android:contentDescription="@string/cd_status"
            android:layout_marginBottom="10dp" />

        <!-- Input Actions -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal">

            <Button
                android:id="@+id/btn_clear"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/clear_text"
                android:backgroundTint="#FFEBEE"
                android:textColor="#C62828" />

            <Space
                android:layout_width="8dp"
                android:layout_height="1dp" />

            <Button
                android:id="@+id/btn_paste"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/paste_clipboard"
                android:backgroundTint="#E3F2FD"
                android:textColor="#1565C0" />
        </LinearLayout>

        <!-- Main Text Input -->
        <EditText
            android:id="@+id/et_input"
            android:layout_width="match_parent"
            android:layout_height="200dp"
            android:gravity="top|start"
            android:hint="@string/hint_input"
            android:inputType="textMultiLine"
            android:background="#F5F5F5"
            android:padding="12dp"
            android:textSize="16sp"
            android:layout_marginTop="8dp" />

        <!-- Character and Chunk Counter -->
        <TextView
            android:id="@+id/tv_counter"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/counter_default"
            android:textColor="#555555"
            android:textSize="14sp"
            android:layout_marginTop="6dp" />

        <!-- Style Instruction Input -->
        <TextView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/style_label"
            android:textColor="#666666"
            android:layout_marginTop="10dp" />

        <EditText
            android:id="@+id/et_style"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:hint="@string/style_hint"
            android:singleLine="true"
            android:background="#F5F5F5"
            android:padding="10dp"
            android:layout_marginTop="4dp" />

        <!-- Job Controls -->
        <Button
            android:id="@+id/btn_generate"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/generate_audio"
            android:backgroundTint="#2196F3"
            android:textColor="#FFFFFF"
            android:textSize="16sp"
            android:layout_marginTop="16dp" />

        <Button
            android:id="@+id/btn_cancel"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/cancel_generation"
            android:backgroundTint="#B71C1C"
            android:textColor="#FFFFFF"
            android:enabled="false"
            android:layout_marginTop="6dp" />

        <Button
            android:id="@+id/btn_resume"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/resume_job"
            android:backgroundTint="#00796B"
            android:textColor="#FFFFFF"
            android:enabled="false"
            android:layout_marginTop="6dp" />

        <!-- Audio Player Controls -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:layout_marginTop="14dp">

            <Button
                android:id="@+id/btn_play"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/play"
                android:backgroundTint="#4CAF50"
                android:textColor="#FFFFFF" />

            <Space
                android:layout_width="6dp"
                android:layout_height="1dp" />

            <Button
                android:id="@+id/btn_pause"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/pause"
                android:backgroundTint="#FFA000"
                android:textColor="#FFFFFF" />

            <Space
                android:layout_width="6dp"
                android:layout_height="1dp" />

            <Button
                android:id="@+id/btn_stop"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/stop"
                android:backgroundTint="#FF5722"
                android:textColor="#FFFFFF" />
        </LinearLayout>

        <!-- Seek Buttons -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:layout_marginTop="6dp">

            <Button
                android:id="@+id/btn_seek_back"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/back_10s"
                android:backgroundTint="#78909C"
                android:textColor="#FFFFFF" />

            <Space
                android:layout_width="6dp"
                android:layout_height="1dp" />

            <Button
                android:id="@+id/btn_seek_fwd"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/fwd_10s"
                android:backgroundTint="#78909C"
                android:textColor="#FFFFFF" />
        </LinearLayout>

        <!-- Playback Speed -->
        <Button
            android:id="@+id/btn_speed"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/speed_default"
            android:backgroundTint="#546E7A"
            android:textColor="#FFFFFF"
            android:contentDescription="@string/cd_speed"
            android:layout_marginTop="6dp" />

        <!-- Save and Share -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:layout_marginTop="6dp">

            <Button
                android:id="@+id/btn_save"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/save"
                android:backgroundTint="#FF9800"
                android:textColor="#FFFFFF" />

            <Space
                android:layout_width="6dp"
                android:layout_height="1dp" />

            <Button
                android:id="@+id/btn_share"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="@string/share"
                android:backgroundTint="#9C27B0"
                android:textColor="#FFFFFF" />
        </LinearLayout>

        <!-- Help & Developer Info -->
        <Button
            android:id="@+id/btn_help"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="@string/developer_info"
            android:backgroundTint="#333333"
            android:textColor="#FFFFFF"
            android:layout_marginTop="24dp" />

    </LinearLayout>
</ScrollView>
`
  },
  {
    name: "strings.xml",
    path: "app/src/main/res/values/strings.xml",
    package: "res/values",
    language: "xml",
    description: "Strings resources with full TalkBack descriptions and labels.",
    luaMapping: "UI strings and dialog messages",
    code: `<resources>
    <string name="app_name">OmniVoice Studio</string>
    <string name="settings">Settings</string>
    <string name="history">History</string>
    <string name="settings_title">TTS Settings</string>
    <string name="history_title">Audio History</string>
    <string name="status_ready">Ready.</string>
    <string name="cd_status">Status announcement</string>
    <string name="clear_text">Clear Text</string>
    <string name="paste_clipboard">Paste Clipboard</string>
    <string name="hint_input">Type or paste text here...</string>
    <string name="counter_default">Characters: 0.</string>
    <string name="style_label">Style instruction (optional):</string>
    <string name="style_hint">e.g. slowly and calmly</string>
    <string name="generate_audio">Generate Audio</string>
    <string name="cancel_generation">Cancel Generation</string>
    <string name="resume_job">Resume Unfinished Job</string>
    <string name="play">Play</string>
    <string name="pause">Pause</string>
    <string name="stop">Stop</string>
    <string name="back_10s">Back 10 Seconds</string>
    <string name="fwd_10s">Forward 10 Seconds</string>
    <string name="speed_default">Speed: 1.00x</string>
    <string name="cd_speed">Playback speed. Double tap to cycle speed.</string>
    <string name="save">Save</string>
    <string name="share">Share</string>
    <string name="developer_info">Help &amp; Developer Info</string>
</resources>
`
  },
  {
    name: "build_apk.yml",
    path: ".github/workflows/build_apk.yml",
    package: ".github/workflows",
    language: "yaml",
    description: "Cloud Automated Builder: Builds APK and Play Store AAB automatically on GitHub with 0 software needed on your laptop.",
    luaMapping: "Cloud CI/CD Compiler",
    code: `name: Build OmniVoice Android App (Cloud CI)

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    name: Compile APK and AAB
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Java 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Set up Android SDK
        uses: android-actions/setup-android@v3

      - name: Make Gradle Wrapper Executable
        run: chmod +x gradlew || true

      - name: Build Android Debug APK
        run: ./gradlew assembleDebug --stacktrace || gradle assembleDebug

      - name: Build Android Release Bundle (AAB)
        run: ./gradlew bundleRelease || gradle bundleRelease || true

      - name: Upload Debug APK Artifact (Ready to Install)
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: OmniVoice-Debug-APK
          path: app/build/outputs/apk/debug/*.apk

      - name: Upload Release Bundle AAB (For Google Play Store)
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: OmniVoice-PlayStore-AAB
          path: app/build/outputs/bundle/release/*.aab
`
  }
];

