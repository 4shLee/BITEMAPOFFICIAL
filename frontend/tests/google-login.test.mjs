import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loginSource = await readFile(
  new URL('../src/app/pages/Login.tsx', import.meta.url),
  'utf8'
);

const apiSource = await readFile(
  new URL('../src/lib/services/api.ts', import.meta.url),
  'utf8'
);

const requestAccessSource = await readFile(
  new URL('../src/app/pages/RequestAccountApproval.tsx', import.meta.url),
  'utf8'
);

test('Login page renders Continue with Google button alongside existing email/password login', () => {
  assert.match(loginSource, /Continue with Google/);
  assert.match(loginSource, /handleGoogleSignIn/);
  assert.match(loginSource, /type="button"[\s\S]*onClick=\{handleGoogleSignIn\}/);
  assert.match(loginSource, /type="submit"/);
  assert.match(loginSource, /showPassword/);
  assert.match(loginSource, /isGoogleLoading/);
  assert.match(loginSource, /Connecting to Google\.\.\./);
});

test('Login page binds OAuth state in sessionStorage and handles cancellation and errors safely', () => {
  assert.match(loginSource, /GOOGLE_OAUTH_STATE_STORAGE_KEY = "bitemap_google_oauth_state"/);
  assert.match(loginSource, /sessionStorage\.setItem\(GOOGLE_OAUTH_STATE_STORAGE_KEY/);
  assert.match(loginSource, /sessionStorage\.getItem\(GOOGLE_OAUTH_STATE_STORAGE_KEY\)/);
  assert.match(loginSource, /sessionStorage\.removeItem\(GOOGLE_OAUTH_STATE_STORAGE_KEY\)/);
  assert.match(loginSource, /!expectedState \|\| expectedState !== state/);
  assert.doesNotMatch(loginSource, /error_description/);
  assert.match(loginSource, /processedOAuthCallbackRef/);
  assert.match(loginSource, /authAPI\.getGoogleAuthUrl\(\)/);
  assert.match(loginSource, /authAPI\.signInWithGoogle\(code, state\)/);
  assert.match(loginSource, /access_denied/);
  assert.match(loginSource, /Google sign-in was cancelled\./);
  assert.match(loginSource, /role="alert"/);
  assert.match(loginSource, /getDefaultPathForRole\(result\.user\?\.role\)/);
});

test('Frontend API client exposes Google OAuth helpers and never includes Google client secrets', () => {
  assert.match(apiSource, /getGoogleAuthUrl\(\)/);
  assert.match(apiSource, /\/auth\/google\/redirect/);
  assert.match(apiSource, /signInWithGoogle\(code: string, state: string\)/);
  assert.match(apiSource, /\/auth\/google\/callback/);
  assert.doesNotMatch(apiSource, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(loginSource, /GOOGLE_CLIENT_SECRET/);
});

test('Unregistered Google account redirects to Request Access with prefilled email and guidance notice without auto-registration', () => {
  assert.match(loginSource, /error\.status === 403/);
  assert.match(loginSource, /error\.code === "unregistered_google_account"/);
  assert.match(loginSource, /navigate\("\/request-account-approval"/);
  assert.match(loginSource, /googleUnregisteredEmail:\s*verifiedEmail/);
  assert.match(loginSource, /Your Google account is not registered with BITEMAP yet\. Complete this access request to ask your clinic administrator for approval\./);
  assert.match(requestAccessSource, /useLocation/);
  assert.match(requestAccessSource, /googleUnregisteredEmail/);
  assert.match(requestAccessSource, /googleUnregisteredNotice/);
  assert.match(requestAccessSource, /authAPI\.signUp\(/);
});
