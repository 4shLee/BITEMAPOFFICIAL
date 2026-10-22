import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const passwordPolicySource = await readFile(
  new URL('../src/lib/auth/passwordPolicy.ts', import.meta.url),
  'utf8'
);
const requestApprovalSource = await readFile(
  new URL('../src/app/pages/RequestAccountApproval.tsx', import.meta.url),
  'utf8'
);
const usersSource = await readFile(
  new URL('../src/app/pages/Users.tsx', import.meta.url),
  'utf8'
);
const loginSource = await readFile(
  new URL('../src/app/pages/Login.tsx', import.meta.url),
  'utf8'
);

test('passwordPolicy defines all required password rules and clear labels', () => {
  assert.match(passwordPolicySource, /MIN_PASSWORD_LENGTH = 8/);
  assert.match(passwordPolicySource, /At least 8 characters/);
  assert.match(passwordPolicySource, /At least one uppercase letter \(A–Z\)/);
  assert.match(passwordPolicySource, /At least one lowercase letter \(a–z\)/);
  assert.match(passwordPolicySource, /At least one number \(0–9\)/);
  assert.match(passwordPolicySource, /At least one special character \(e\.g\., @, #, !, \$\)/);
  assert.match(passwordPolicySource, /\/\[A-Z\]\/\.test\(password\)/);
  assert.match(passwordPolicySource, /\/\[a-z\]\/\.test\(password\)/);
  assert.match(passwordPolicySource, /\/\[0-9\]\/\.test\(password\)/);
  assert.match(passwordPolicySource, /\/\[\^A-Za-z0-9\\s\]\/\.test\(password\)/);
});

test('RequestAccountApproval enforces password policy and renders requirements and validation feedback', () => {
  assert.match(requestApprovalSource, /evaluatePasswordPolicy/);
  assert.match(requestApprovalSource, /if \(!passwordEvaluation\.isValid\)/);
  assert.match(requestApprovalSource, /Password Requirements:/);
  assert.match(requestApprovalSource, /aria-label="Password requirements"/);
  assert.match(requestApprovalSource, /aria-invalid=\{showPasswordValidationFeedback\}/);
  assert.match(requestApprovalSource, /role="alert"/);
});

test('Users modal enforces password policy when resetting a user password', () => {
  assert.match(usersSource, /evaluatePasswordPolicy/);
  assert.match(usersSource, /if \(hasPasswordInput && !passwordEvaluation\.isValid\)/);
  assert.match(usersSource, /Password Requirements:/);
  assert.match(usersSource, /role="alert"/);
});

test('Login page allows existing valid accounts to sign in without enforcing new password complexity on login', () => {
  assert.doesNotMatch(loginSource, /evaluatePasswordPolicy/);
});
