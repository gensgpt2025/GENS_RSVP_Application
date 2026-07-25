export const ORGANIZATION_CODE_PATTERN = /^[A-Z0-9_-]{3,24}$/;

export function normalizeOrganizationCode(value: string) {
  return value.trim().toUpperCase();
}

export function organizationCodeValidationMessage(value: string) {
  if (!value) {
    return "団体コードを入力してください。";
  }

  if (!ORGANIZATION_CODE_PATTERN.test(value)) {
    return "団体コードは3〜24文字の英数字、ハイフン、アンダーバーで設定してください。";
  }

  return null;
}

export function validateOrganizationCodeChange(currentCode: string, newCode: string, confirmationCode: string) {
  const normalizedCurrentCode = normalizeOrganizationCode(currentCode);
  const normalizedNewCode = normalizeOrganizationCode(newCode);
  const normalizedConfirmationCode = normalizeOrganizationCode(confirmationCode);

  const currentCodeError = organizationCodeValidationMessage(normalizedCurrentCode);
  if (currentCodeError) return currentCodeError;

  const newCodeError = organizationCodeValidationMessage(normalizedNewCode);
  if (newCodeError) return newCodeError;

  if (normalizedNewCode !== normalizedConfirmationCode) {
    return "新しい団体コードと確認用コードが一致しません。";
  }

  if (normalizedCurrentCode === normalizedNewCode) {
    return "現在と異なる団体コードを設定してください。";
  }

  return null;
}
