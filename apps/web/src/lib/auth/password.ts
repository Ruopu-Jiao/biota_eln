import { hash, verify } from "@node-rs/argon2";

const passwordOptions = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string) {
  return hash(password, passwordOptions);
}

export async function verifyPassword(hashValue: string, password: string) {
  return verify(hashValue, password, passwordOptions);
}
