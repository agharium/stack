const USERNAME_MAX_LENGTH = 50;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 50) {
    throw new Error("O nome deve ter entre 2 e 50 caracteres.");
  }
  return name;
}

export function validateUsername(value: string): string {
  const username = normalizeUsername(value);
  if (username.length < 2 || username.length > USERNAME_MAX_LENGTH) {
    throw new Error("O username deve ter entre 2 e 50 caracteres.");
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new Error(
      "O username só pode conter letras minúsculas, números, ponto, hífen e sublinhado.",
    );
  }
  return username;
}

export function validatePassword(value: string): string {
  if (value.length < 8) {
    throw new Error("A senha deve ter pelo menos 8 caracteres.");
  }
  return value;
}

export function validateGuestNickname(value: string): string {
  const nickname = value.trim().replace(/\s+/g, " ");
  if (nickname.length < 2 || nickname.length > 50) {
    throw new Error("O nome deve ter entre 2 e 50 caracteres.");
  }
  return nickname;
}
