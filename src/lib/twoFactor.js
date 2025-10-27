import crypto from "crypto";

const MAX_CODE_ATTEMPTS = 25;
const CODE_PATTERN = /^\d{6}$/;

const buildTwoFactorError = (message, statusCode = 401) => {
  const error = new Error(message);
  error.name = "TwoFactorValidationError";
  error.statusCode = statusCode;
  return error;
};

export const isValidStaticCode = (code) => {
  if (typeof code !== "string") return false;
  const trimmed = code.trim();
  return CODE_PATTERN.test(trimmed);
};

export async function generateUniqueTwoFactorCode(tx) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const candidate = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const existing = await tx.user.findUnique({ where: { twoFactorCode: candidate } });
    if (!existing) {
      return candidate;
    }
  }
  throw buildTwoFactorError("No se pudo generar un código de verificación único", 500);
}

export async function ensureUserTwoFactorCode(tx, userId) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { twoFactorCode: true } });
  if (user?.twoFactorCode) {
    return user.twoFactorCode;
  }
  const code = await generateUniqueTwoFactorCode(tx);
  await tx.user.update({ where: { id: userId }, data: { twoFactorCode: code } });
  return code;
}

export async function findUserByTwoFactorCode(tx, code) {
  if (!isValidStaticCode(code)) {
    throw buildTwoFactorError("El código ingresado debe tener 6 dígitos", 400);
  }

  const normalized = code.trim();
  const user = await tx.user.findUnique({ where: { twoFactorCode: normalized } });
  if (!user) {
    throw buildTwoFactorError("El código ingresado no es válido", 401);
  }
  return user;
}

export { buildTwoFactorError };
