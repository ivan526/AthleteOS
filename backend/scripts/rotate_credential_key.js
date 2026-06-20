const { PrismaClient } = require('@prisma/client');
const {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} = require('crypto');

const PREFIX = 'enc:v1:';
const prisma = new PrismaClient();

function parseKey(value, name) {
  if (/^[a-f0-9]{64}$/i.test(value || '')) return Buffer.from(value, 'hex');
  const decoded = Buffer.from(value || '', 'base64');
  if (decoded.length === 32) return decoded;
  throw new Error(`${name} must be 32-byte base64 or 64-character hex`);
}

function decrypt(value, key) {
  if (!value || !value.startsWith(PREFIX)) return value;
  const [, , iv, tag, encrypted] = value.split(':');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function encrypt(value, key) {
  if (!value) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return `${PREFIX}${iv.toString('base64url')}:${cipher
    .getAuthTag()
    .toString('base64url')}:${encrypted.toString('base64url')}`;
}

async function main() {
  const oldKey = parseKey(
    process.env.OLD_CREDENTIAL_ENCRYPTION_KEY,
    'OLD_CREDENTIAL_ENCRYPTION_KEY',
  );
  const newKey = parseKey(
    process.env.CREDENTIAL_ENCRYPTION_KEY,
    'CREDENTIAL_ENCRYPTION_KEY',
  );
  const accounts = await prisma.connectedAccount.findMany({
    select: { id: true, apiKey: true },
  });
  const llmSettings = await prisma.llmSetting.findMany({
    select: { id: true, apiKey: true },
  });

  for (const account of accounts) {
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: { apiKey: encrypt(decrypt(account.apiKey, oldKey), newKey) },
    });
  }
  for (const setting of llmSettings) {
    await prisma.llmSetting.update({
      where: { id: setting.id },
      data: {
        apiKey: setting.apiKey
          ? encrypt(decrypt(setting.apiKey, oldKey), newKey)
          : null,
      },
    });
  }
  console.log(
    `Rotated ${accounts.length + llmSettings.length} credential records`,
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
