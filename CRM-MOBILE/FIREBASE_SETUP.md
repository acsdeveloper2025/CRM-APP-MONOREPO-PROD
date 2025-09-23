# 🔥 Firebase Production Setup Guide

## Overview
This guide will help you set up Firebase for the CaseFlow Mobile app in production.

## Prerequisites
- Google account
- Access to Firebase Console
- Admin access to this repository

## Step 1: Create Firebase Project

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Create New Project:**
   - Click "Create a project"
   - Project name: `CaseFlow-Mobile-Prod` (or your preferred name)
   - Enable Google Analytics (recommended)
   - Choose your Analytics account or create new one

## Step 2: Add Android App

1. **Register Android App:**
   - Click "Add app" → Android icon
   - **Android package name:** `com.caseflow.mobile`
   - **App nickname:** `CaseFlow Mobile Android`
   - **Debug signing certificate SHA-1:** (add later for release builds)

2. **Download Configuration:**
   - Download `google-services.json`
   - Replace the template file: `CRM-MOBILE/android/app/google-services.json.template`
   - Rename it to: `google-services.json`

## Step 3: Add iOS App (Optional)

1. **Register iOS App:**
   - Click "Add app" → iOS icon
   - **iOS bundle ID:** `com.caseflow.mobile`
   - **App nickname:** `CaseFlow Mobile iOS`

2. **Download Configuration:**
   - Download `GoogleService-Info.plist`
   - Replace the template file: `CRM-MOBILE/ios/App/GoogleService-Info.plist.template`
   - Rename it to: `GoogleService-Info.plist`

## Step 4: Enable Firebase Services

### Authentication
1. Go to Authentication → Sign-in method
2. Enable Email/Password
3. Enable any other providers you need (Google, Facebook, etc.)

### Cloud Messaging (Push Notifications)
1. Go to Cloud Messaging
2. No additional setup needed - automatically enabled
3. Note down the Server Key for backend integration

### Firestore Database (Optional)
1. Go to Firestore Database
2. Create database in production mode
3. Choose your region (closest to your users)
4. Set up security rules as needed

## Step 5: Update Configuration Files

### Android Configuration
```bash
# Replace the template with your actual file
mv CRM-MOBILE/android/app/google-services.json.template CRM-MOBILE/android/app/google-services.json
# Edit the file with your actual Firebase configuration
```

### iOS Configuration (if using iOS)
```bash
# Replace the template with your actual file
mv CRM-MOBILE/ios/App/GoogleService-Info.plist.template CRM-MOBILE/ios/App/GoogleService-Info.plist
# Edit the file with your actual Firebase configuration
```

## Step 6: Test Firebase Integration

### Build and Test
```bash
# Navigate to mobile app
cd CRM-MOBILE

# Install dependencies
npm install

# Build for Android
npm run build
npx cap sync android

# Test on device or emulator
npx cap run android
```

### Verify Integration
1. Check app logs for Firebase initialization
2. Test push notifications
3. Verify authentication works
4. Check Firebase Console for active users

## Security Considerations

### Production Security Rules
- Set up proper Firestore security rules
- Configure Authentication settings
- Enable App Check for additional security
- Set up proper CORS settings

### API Keys
- Restrict API keys to specific apps/domains
- Monitor API usage in Google Cloud Console
- Set up billing alerts

## Troubleshooting

### Common Issues
1. **Build fails:** Check if google-services.json is in correct location
2. **Push notifications not working:** Verify FCM configuration
3. **Authentication fails:** Check API key restrictions

### Debug Commands
```bash
# Check Firebase configuration
npx cap doctor

# View detailed logs
npx cap run android --livereload --external

# Check Firebase connection
adb logcat | grep Firebase
```

## Environment Variables

For additional security, you can use environment variables:

```bash
# .env.production
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
```

## Next Steps

1. Set up Firebase project following this guide
2. Replace template files with actual configuration
3. Test the integration
4. Deploy to production
5. Monitor Firebase Console for usage and errors

## Support

- Firebase Documentation: https://firebase.google.com/docs
- Capacitor Firebase: https://capacitorjs.com/docs/guides/push-notifications-firebase
- Issues: Create GitHub issue in this repository
