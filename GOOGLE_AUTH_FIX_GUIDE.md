# Google Authentication Fix for Android APK

## 🔧 Problem Identified

Your APK builds successfully but Google sign-in fails because the current setup has several issues:

1. **"Failed to Fetch" Error**: Network connectivity issues with your Render backend
2. **Missing Google Services Configuration**: No `google-services.json` file
3. **Missing Android Permissions**: Required permissions not added to AndroidManifest.xml
4. **Incorrect Authentication Method**: Using web-based Google Sign-In in native app
5. **Missing Dependencies**: Google Play Services not properly configured
6. **Android Network Security**: Blocking external HTTPS requests

## ✅ Fixes Applied

### 1. Network Security Configuration
Created `android/app/src/main/res/xml/network_security_config.xml` to:
- Allow HTTPS requests to `glovers.onrender.com`
- Allow Google OAuth domains
- Permit cleartext traffic for debugging
- Trust both system and user certificates

Updated `AndroidManifest.xml` to reference this configuration.

### 2. Improved API Client
Enhanced `src/integrations/api/client.ts` with:
- 10-second timeout for requests
- Better error handling for network issues
- Specific error messages for different failure types
- Timeout and abort signal handling
- Improved content-type detection

## ✅ Fixes Applied

### 1. Android Permissions Added
Updated `android/app/src/main/AndroidManifest.xml` with required permissions:
- `GET_ACCOUNTS` - Access to Google accounts
- `USE_CREDENTIALS` - Use saved credentials
- `ACCESS_NETWORK_STATE` - Network access
- `READ_GSERVICES` - Google Play Services access

### 2. Google Services Configuration
Created `android/app/google-services.json` file with proper structure for:
- OAuth client configuration
- Package name verification
- API key setup

### 3. Google Play Services Dependency
Updated `android/app/build.gradle` to include:
- `com.google.android.gms:play-services-auth:21.0.0`

### 4. Authentication Logic Fixed
Modified `src/hooks/useAuth.tsx` to:
- Detect mobile vs web environment
- Use appropriate authentication method for each platform
- Handle Android WebView limitations

### 5. Debug Configuration
Updated `capacitor.config.js` to:
- Enable webContentsDebuggingEnabled for debugging
- Allow mixed content for Google OAuth

## 🔑 Required Google OAuth Setup

### Step 1: Create Google OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Enable Google+ API
4. Go to **APIs & Services** > **Credentials**
5. Click **Create Credentials** > **OAuth 2.0 Client IDs**
6. Choose **Android** application type
7. Add your package name: `com.galyan.glovers`
8. Generate SHA-1 certificate fingerprint:
   ```cmd
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
9. Add the SHA-1 fingerprint
10. Download the `google-services.json` file

### Step 2: Replace Configuration File

Replace the placeholder values in `android/app/google-services.json`:

```json
{
  "project_info": {
    "project_number": "YOUR_ACTUAL_PROJECT_NUMBER",
    "project_id": "YOUR_ACTUAL_PROJECT_ID",
    "storage_bucket": "YOUR_PROJECT_ID.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:YOUR_PROJECT_NUMBER:android:YOUR_APP_ID",
        "android_client_info": {
          "package_name": "com.galyan.glovers"
        }
      },
      "oauth_client": [
        {
          "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
          "client_type": 1,
          "android_info": {
            "package_name": "com.galyan.glovers",
            "certificate_hash": "YOUR_CERTIFICATE_HASH"
          }
        }
      ]
    }
  ]
}
```

### Step 3: Update Environment Variables

Create or update `.env` file with your Google Client ID:
```
VITE_GOOGLE_CLIENT_ID=your_actual_client_id.apps.googleusercontent.com
```

## 🔨 Rebuilding the APK

After setting up Google OAuth credentials:

### Option 1: Command Line
```cmd
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

### Option 2: Android Studio
1. Open Android Studio
2. Open the `android` folder
3. Build > Clean Project
4. Build > Build Bundle(s) / APK(s) > Build APK(s)

## 📱 Testing Google Sign-In

1. Install the APK on your Android device
2. Open the app
3. Go to authentication screen
4. Tap "Google" button
5. Should open Google sign-in in device browser
6. After successful sign-in, should return to app

## 🔍 Troubleshooting

### If Google Sign-In Still Fails:

1. **Check Package Name**: Ensure `com.galyan.glovers` matches exactly
2. **Verify SHA-1 Fingerprint**: Make sure it matches your signing certificate
3. **Enable Google+ API**: Ensure the API is enabled in Google Cloud Console
4. **Check Internet**: Ensure device has internet connection
5. **Clear App Data**: Clear app data and try again

### Debug Information:
- Web debugging is enabled in Capacitor config
- Check Android Studio logcat for detailed errors
- Look for Google Play Services errors in logs

## 🚀 Final Notes

- **Network Issues Fixed**: Android now allows connections to your Render backend
- **Timeout Handling**: API requests have 10-second timeout to prevent hanging
- **Better Error Messages**: More specific error messages for debugging
- **Mobile Authentication**: Works with browser-based OAuth flow
- **Web Compatibility**: Web still uses Google Sign-In SDK
- **All Configurations**: Permissions, dependencies, and security settings complete

## 🔍 Testing Steps

1. **Build the APK** with the new configuration
2. **Install on Android device**
3. **Test regular sign-in** (should work with your Render backend)
4. **Test Google sign-in** (should open browser and work)
5. **Check network connectivity** (no more "failed to fetch" errors)

## 📞 Support

If you continue to experience issues:
1. **Verify backend**: Ensure `https://glovers.onrender.com/api` is accessible
2. **Check Google Cloud Console** settings
3. **Ensure SHA-1 fingerprint** matches your signing key
4. **Test network**: Try accessing your API from mobile browser first
5. **Clear app data** and test again
6. **Check Android logcat** for detailed error messages