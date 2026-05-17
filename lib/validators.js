const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_ROLES = ["ADMIN", "MANAGER", "WORKER", "SALES", "FINANCE"];

export function isValidEmail(email) {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim());
}

export function isValidRole(role) {
  return VALID_ROLES.includes(role);
}

export { VALID_ROLES };
