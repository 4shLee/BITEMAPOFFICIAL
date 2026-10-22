export const MIN_PASSWORD_LENGTH = 8;

export type PasswordRequirementKey =
  | 'minLength'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'special';

export type PasswordRequirementRule = {
  key: PasswordRequirementKey;
  label: string;
  shortLabel: string;
  errorText: string;
  test: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENT_RULES: readonly PasswordRequirementRule[] = [
  {
    key: 'minLength',
    label: 'At least 8 characters',
    shortLabel: '8+ characters',
    errorText: 'at least 8 characters',
    test: (password: string) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    key: 'uppercase',
    label: 'At least one uppercase letter (A–Z)',
    shortLabel: 'Uppercase (A–Z)',
    errorText: 'at least one uppercase letter (A–Z)',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    key: 'lowercase',
    label: 'At least one lowercase letter (a–z)',
    shortLabel: 'Lowercase (a–z)',
    errorText: 'at least one lowercase letter (a–z)',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    key: 'number',
    label: 'At least one number (0–9)',
    shortLabel: 'Number (0–9)',
    errorText: 'at least one number (0–9)',
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    key: 'special',
    label: 'At least one special character (e.g., @, #, !, $)',
    shortLabel: 'Special character (@, #, !, $)',
    errorText: 'at least one special character (e.g., @, #, !, $)',
    test: (password: string) => /[^A-Za-z0-9\s]/.test(password),
  },
];

export type EvaluatedPasswordRequirement = {
  key: PasswordRequirementKey;
  label: string;
  shortLabel: string;
  errorText: string;
  met: boolean;
};

export type PasswordPolicyEvaluation = {
  isValid: boolean;
  checks: EvaluatedPasswordRequirement[];
  unmet: EvaluatedPasswordRequirement[];
  errorMessage: string | null;
};

export function evaluatePasswordPolicy(password: string): PasswordPolicyEvaluation {
  const checks: EvaluatedPasswordRequirement[] = PASSWORD_REQUIREMENT_RULES.map((rule) => ({
    key: rule.key,
    label: rule.label,
    shortLabel: rule.shortLabel,
    errorText: rule.errorText,
    met: rule.test(password),
  }));

  const unmet = checks.filter((item) => !item.met);
  const isValid = unmet.length === 0;

  const errorMessage = isValid
    ? null
    : 'Password must contain ' + unmet.map((item) => item.errorText).join(', ') + '.';

  return {
    isValid,
    checks,
    unmet,
    errorMessage,
  };
}
