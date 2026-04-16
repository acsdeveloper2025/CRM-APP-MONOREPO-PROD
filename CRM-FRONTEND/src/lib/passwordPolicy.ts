export const PASSWORD_POLICY = {
  minLength: 8,
  hasLowercase: /[a-z]/,
  hasUppercase: /[A-Z]/,
  hasNumber: /\d/,
  hasSpecialChar: /[^A-Za-z0-9]/,
};

export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export interface PasswordPolicyChecks {
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export const getPasswordPolicyChecks = (password: string): PasswordPolicyChecks => ({
  minLength: password.length >= PASSWORD_POLICY.minLength,
  hasLowercase: PASSWORD_POLICY.hasLowercase.test(password),
  hasUppercase: PASSWORD_POLICY.hasUppercase.test(password),
  hasNumber: PASSWORD_POLICY.hasNumber.test(password),
  hasSpecialChar: PASSWORD_POLICY.hasSpecialChar.test(password),
});

export const isPasswordPolicyValid = (password: string): boolean => {
  return PASSWORD_POLICY_REGEX.test(password);
};
