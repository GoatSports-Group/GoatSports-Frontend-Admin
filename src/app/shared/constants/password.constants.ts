/** Regex for password pattern validation: min 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
