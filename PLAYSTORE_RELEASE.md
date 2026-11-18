# PayCore – Play Store release runbook

App: **PayCore** · package `com.femi9.payroll` (permanent, cannot change after first upload) · Expo SDK 57 · EAS project `e322810c-4279-4793-81f4-2a48e9114765`

---

## 1. Firebase / FCM (needed for every push: shift-reminder bell, chat, approvals, announcements, admin "Ping now")

1. https://console.firebase.google.com → **Add project** (Analytics optional).
2. **Add app → Android**, package name `com.femi9.payroll`. Download **google-services.json**.
3. Give it to the build – pick ONE:
   - put `google-services.json` in the project root (next to `app.json`) and commit it, **or**
   - upload it to EAS (keeps it out of git):
     ```
     eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --environment preview --environment development
     ```
   `app.config.js` picks up either one automatically. Without it the app still builds, but Android gets no push.
4. Firebase → Project settings → **Service accounts** → **Generate new private key** (JSON).
5. Upload that key to Expo so the backend's Expo push calls reach FCM:
   ```
   eas credentials   →  Android  →  production  →  Google Service Account
                     →  "Manage your Google Service Account Key for Push Notifications (FCM V1)"  →  upload the JSON
   ```
6. Rebuild the app (google-services.json is native config – an OTA update is not enough).

**Test:** install the preview APK → log in → open Home (token registers) → Settings/Notifications → **Bell test** (local) → then have the server send a shift reminder / chat message with the app closed.

## 2. Google Maps key (admin Live Tracking map on Android)

1. Google Cloud console (same project as Firebase is fine) → enable **Maps SDK for Android**.
2. Create an API key → restrict to **Android apps**: package `com.femi9.payroll` + SHA-1 of
   - the EAS upload key (`eas credentials` → Android → shows SHA-1), and
   - the **Play app signing key** (Play Console → Test and release → App integrity), after the first upload.
3. ```
   eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --environment production --environment preview
   ```

## 3. Backend before release

- [ ] Served over **HTTPS** at `https://payroll.brainmarq.com` (Android release builds refuse plain http).
- [ ] `app.security.otp.expose-dev-otp` **not set / false** on the server (OTP must only go by email).
  Set `app.security.otp.expose-dev-otp=true` only in a local `application.properties` if you need it for testing.
- [ ] OTP email works from the server (SES out of sandbox / SMTP, SPF + DKIM for the sender domain).
- [ ] `onboarding.form-base-url` = the public **https** web URL of the candidate form (candidates use the website, not the app).
- [ ] Upload size limit (nginx `client_max_body_size`) ≥ the onboarding documents total.
- [ ] Deployed with the new `POST /api/notifications/token/remove` endpoint (logout).

## 3b. API login protection (rollout)

The backend now checks a login token on every `/api` call, and that employees only touch their own data
(`JwtAuthenticationFilter` + `ApiAccessPolicy`). Two switches, each `OFF` / `LOG` / `ENFORCE`:

| Env variable on the server | Property | What it checks |
|---|---|---|
| `API_AUTH_TOKEN_MODE` | `app.security.api-auth.token-mode` | a valid login token is present (except login, OTP, candidate form, server time, profile photos) |
| `API_AUTH_ACCESS_MODE` | `app.security.api-auth.access-mode` | employees use only their own `empId`; admin endpoints need ADMIN / MANAGER (or an id in `privileged-emp-ids`); `adminEmpId` is always the logged-in user |
| `PAYCORE_JWT_SECRET` | `paycore.jwt.secret` | **set a new random 64+ character value in production** |

Rollout order:
1. Deploy the backend with both modes = `LOG` (the default). Nothing is blocked.
2. Deploy the new web build and install the new app build (they send the token).
3. Use the app for a day or two (employee + admin + sales head). Search the server log for `[API-AUTH]`:
   - `would reject TOKEN_MISSING` → a screen or old client without the token (old app/web build still in use?)
   - `would deny ... admin-only endpoint` / `... is another employee` → either an attack, or a real feature that needs a rule change in `ApiAccessPolicy`
4. When the log is clean: `API_AUTH_TOKEN_MODE=ENFORCE`, restart. A day later: `API_AUTH_ACCESS_MODE=ENFORCE`, restart.
5. Problem after ENFORCE? Set the mode back to `LOG` and restart - no new build needed.

Run `ApiAccessPolicyTest` in IntelliJ after any change to the rules.

## 3c. File storage (S3 bucket)

All uploads go to the bucket in `storage.s3.bucket` (`storage.mode=S3`), in separate folders:

| Folder | What |
|---|---|
| `Onboarding/<Name>_<date>_<mobile last 4>/` | candidate documents + `Onboarding/onboarding_statements.xlsx` |
| `Profile/<EMPID>.jpg` | profile photo (one per employee, replaced on upload) |
| `Chat/<channelId>/<yyyy-MM>/<id>_<file>` | chat attachments (opened through `/api/workspace/file`, members only, 10-minute S3 link) |
| `Imports/<yyyy-MM-dd>/<type>/<id>_<file>` | a copy of every Excel import (users, bulk import) |

The bucket stays **private** (no public access). The IAM user needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*` and `s3:ListBucket` on `arn:aws:s3:::<bucket>`.
Old profile photos on the server disk are copied to the bucket automatically the first time they are viewed.
Old chat messages keep their Supabase links.

## 4. Build

```
npm i -g eas-cli
eas login
npx expo-doctor                                  # must say all checks passed
eas build -p android --profile preview           # APK for testing on real phones
eas build -p android --profile production        # .aab for the Play Store (versionCode auto-increments)
```

Test on a real Android phone with the **preview** APK first: login + email OTP, check-in/out with selfie and location, sales live tracking (disclosure → "Allow all the time"), shift-reminder bell with app closed, chat push → tap opens the room, approval push, payslip download, onboarding link (web), logout from Settings.

## 5. Play Console

1. Create the app (name PayCore, App, Free).
2. **App content**: Privacy policy URL · App access (give the reviewer a demo Employee ID + how to get past OTP) · Ads: No · Content rating questionnaire · Target audience 18+ · Data safety (location, photos, name/email/phone, financial info – salary, documents; data encrypted in transit; shared with employer) · **Permissions declaration for background location** (short video: check-in → disclosure dialog → "Allow all the time" → route on admin map) · **Foreground service – location** declaration (same video).
3. **Store listing**: short + full description, 512×512 icon, 1024×500 feature graphic, ≥2 phone screenshots.
4. **Internal testing** → create release → upload the first `.aab` **manually** (the Google API needs one manual upload).
5. Copy the app-signing SHA-1 from App integrity into the Maps key restriction (and Firebase project settings).
6. Personal developer account: **closed testing with ≥12 testers for 14 days** is required before Production. Organization account: can go to Production directly.
7. Production → create release → roll out.

## 6. Without the Play Store: direct APK + automatic updates (current plan)

### One-time setup
1. Run `BE/src/main/resources/db/app_release.sql` on the database (creates the `app_release` table).
2. Deploy the backend (new: `/api/app/version`, `/api/app/download`, 426 blocking of old builds).
3. Back up the signing key: `eas credentials` -> Android -> production -> **Download keystore**. Keep it safe forever -
   the Play Store move later uses the SAME key so employees can update without reinstalling.
4. First APK: `eas build -p android --profile release-apk` (versionCode goes up automatically).
5. Upload the APK to the S3 bucket as `Releases/paycore-<versionCode>.apk`
   (Content-Type `application/vnd.android.package-archive`), then:
   ```sql
   UPDATE app_release SET latest_build = <versionCode>, latest_version_name = '1.0.0',
          download_url = 's3:Releases/paycore-<versionCode>.apk' WHERE app_id = 'com.femi9.payroll';
   ```
6. Employees install from `https://frontend.brainmarq.com/api/app/download?app=com.femi9.payroll`
   (allow "Install unknown apps" for the browser; Play Protect may warn "unrecognised app" -> Install anyway).

### Which kind of release?
| Change | How to release | Employees |
|---|---|---|
| Screens, logic, texts, API calls (JavaScript only) | `eas update --channel production --message "what changed"` | App updates itself at the next start (or after 15 min in background) |
| New library / permission / plugin, app.json change, Firebase file, icon, Expo upgrade | Increase `"version"` in app.json (e.g. 1.0.0 -> 1.0.1), then `eas build -p android --profile release-apk`, upload the APK, update `app_release` | Popup: "Update available" (optional) or "Update required" (blocked) |

Rule: OTA updates only reach builds with the same app.json `"version"`. ALWAYS raise `"version"` when you make a native change,
otherwise an OTA update could reach an APK that does not have the new native code and crash.

### Forcing an APK update
```sql
-- optional popup with "Later"
UPDATE app_release SET latest_build = 15, latest_version_name = '1.0.1',
       download_url = 's3:Releases/paycore-15.apk' WHERE app_id = 'com.femi9.payroll';
-- blocked until updated (do this only AFTER the APK is uploaded and the download link works)
UPDATE app_release SET min_build = 15 WHERE app_id = 'com.femi9.payroll';
```
Takes effect within 60 seconds. Apps below `min_build` see the update screen at start/resume, and every API call answers
`426 UPDATE_REQUIRED` (switch off with env `APP_UPDATE_BLOCK_OLD_BUILDS=false`).

Test app: same steps with profile `test`, channel `test` (`eas update --channel test`) and the row `com.femi.payroll.test`.

Later releases: `eas build -p android --profile production` then `eas submit -p android` (uploads to the Internal track as a draft; needs a Play service-account key – EAS asks the first time).
JavaScript-only fixes can go out without review: `eas update --channel production`.
