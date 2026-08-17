/**
 * Création (ou mise à jour) d'un compte administrateur.
 *
 *   npm run admin:create -- --email=admin@kerplus.sn --name="Awa Ndiaye" --role=ADMIN
 *
 * Le mot de passe est demandé de manière interactive et n'apparaît jamais dans
 * l'historique du shell. En environnement non interactif, il peut être fourni
 * via la variable d'environnement ADMIN_PASSWORD.
 */
import { createInterface } from 'node:readline';
import { PrismaClient, type AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((argument) => argument.startsWith(prefix));
  return match?.slice(prefix.length);
}

/** Saisie masquée du mot de passe (aucun écho dans le terminal). */
function askPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdout = process.stdout as NodeJS.WriteStream & { muted?: boolean };
    stdout.muted = false;

    const originalWrite = rl.write.bind(rl);
    rl.question(question, (answer) => {
      stdout.write('\n');
      rl.close();
      resolve(answer);
    });

    // Masque les caractères saisis.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rl as any)._writeToOutput = (chunk: string) => {
      if (chunk.includes(question)) {
        originalWrite(chunk);
        return;
      }
      stdout.write('*');
    };
  });
}

function checkPassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 12) errors.push('12 caractères minimum');
  if (!/[a-z]/.test(password)) errors.push('au moins une minuscule');
  if (!/[A-Z]/.test(password)) errors.push('au moins une majuscule');
  if (!/\d/.test(password)) errors.push('au moins un chiffre');
  return errors;
}

async function main(): Promise<void> {
  const email = (readArg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const name = readArg('name') ?? process.env.ADMIN_NAME ?? 'Administrateur Kerplus';
  const role = (readArg('role') ?? 'ADMIN').toUpperCase() as AdminRole;

  if (!email || !email.includes('@')) {
    throw new Error('Adresse email invalide. Utilisez --email=admin@kerplus.sn');
  }
  if (!['ADMIN', 'MANAGER', 'VIEWER'].includes(role)) {
    throw new Error('Rôle invalide. Valeurs autorisées : ADMIN, MANAGER, VIEWER.');
  }

  const password =
    process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length > 0
      ? process.env.ADMIN_PASSWORD
      : await askPassword(`Mot de passe pour ${email} : `);

  const errors = checkPassword(password);
  if (errors.length > 0) {
    throw new Error(`Mot de passe trop faible (${errors.join(', ')}).`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (existing) {
    await prisma.adminUser.update({
      where: { email },
      data: { name, role, passwordHash, active: true },
    });
    console.info(`Compte mis à jour : ${email} (${role})`);
  } else {
    await prisma.adminUser.create({ data: { email, name, role, passwordHash } });
    console.info(`Compte créé : ${email} (${role})`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
