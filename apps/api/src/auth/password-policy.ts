export const REGISTRATION_PASSWORD_HINT = "8–128 символів, велика й мала літера, цифра та спецсимвол (наприклад !, @, #).";

export function registrationPasswordError(password: string): string | null {
  if (password.length < 8) return "Пароль має містити щонайменше 8 символів.";
  if (password.length > 128) return "Максимальна довжина пароля — 128 символів.";
  if (!/\p{Lu}/u.test(password)) return "Додай до пароля велику літеру.";
  if (!/\p{Ll}/u.test(password)) return "Додай до пароля малу літеру.";
  if (!/\p{Nd}/u.test(password)) return "Додай до пароля цифру.";
  if (!/[^\p{L}\p{N}\s]/u.test(password)) return "Додай до пароля спецсимвол (наприклад !, @, #).";
  return null;
}
