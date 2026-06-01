import bcrypt from 'bcrypt';

const saltRounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

export async function hashPassword(plaintextPassword) {
  return bcrypt.hash(plaintextPassword, saltRounds);
}

export async function verifyPassword(plaintextPassword, passwordHash) {
  return bcrypt.compare(plaintextPassword, passwordHash);
}
