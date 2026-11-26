/**
 * Données de DÉMONSTRATION Kër Care — jamais en production.
 *
 * Crée un parcours complet fictif en passant par les services métier réels
 * (mêmes contrôles qu'en conditions réelles) :
 *   - un client de démonstration et sa villa à Dakar (Mermoz) ;
 *   - un climatiseur dont l'entretien est en retard ;
 *   - un prestataire vérifié ;
 *   - une intervention clôturée (affectation, devis, rendez-vous, rapport,
 *     validation, avis) qui alimente l'historique du carnet ;
 *   - une seconde demande en attente de validation du devis par le client.
 *
 * Utilisation : npm run db:seed:care-demo
 * Refus si NODE_ENV=production, sauf ALLOW_DEMO_DATA=true (environnement de
 * recette uniquement — ne jamais l'activer sur la production réelle).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { prisma } from '@/lib/prisma';
import { createClientAccount, createProviderAccount } from '@/lib/care/services/accounts';
import { createEquipment, createProperty } from '@/lib/care/services/properties';
import {
  acceptQuote,
  adminTransition,
  advanceOnSite,
  assignProvider,
  confirmAppointment,
  createQuote,
  createServiceRequest,
  proposeAppointment,
  respondToAssignment,
  submitReport,
  submitReview,
  validateIntervention,
} from '@/lib/care/services/requests';

loadEnv();

const CLIENT_EMAIL = 'demo.client@kerplus.test';
const PROVIDER_EMAIL = 'demo.prestataire@kerplus.test';

function password(): string {
  return process.env.CARE_DEMO_PASSWORD || `Demo-${randomBytes(5).toString('base64url')}7`;
}

function date(daysFromNow: number): Date {
  const value = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  return new Date(`${value.toISOString().slice(0, 10)}T12:00:00.000Z`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_DATA !== 'true') {
    throw new Error('Données de démonstration refusées en production (ALLOW_DEMO_DATA absent).');
  }
  if (await prisma.account.findUnique({ where: { email: CLIENT_EMAIL } })) {
    console.info('Données de démonstration Kër Care déjà présentes : rien à faire.');
    return;
  }

  const admin = await prisma.adminUser.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin)
    throw new Error('Créez d’abord un administrateur (npm run db:seed avec ADMIN_PASSWORD).');
  const category = await prisma.careCategory.findUnique({ where: { slug: 'climatisation' } });
  const acType = await prisma.equipmentType.findUnique({ where: { slug: 'climatiseur' } });
  if (!category || !acType)
    throw new Error('Référentiels Kër Care absents : lancez npm run db:seed.');

  const clientPassword = password();
  const providerPassword = password();

  const client = await createClientAccount({
    name: 'Client Démo',
    email: CLIENT_EMAIL,
    phone: '+221770000001',
    password: clientPassword,
    consent: true,
  });
  const providerAccount = await createProviderAccount(
    {
      name: 'Technicien Démo',
      email: PROVIDER_EMAIL,
      phone: '+221770000002',
      businessName: 'Froid Démo Services (fictif)',
      specialties: ['climatisation', 'electricite'],
      zones: ['Dakar', 'Pikine', 'Guédiawaye'],
      workingHours: 'Lundi–samedi, 8 h – 18 h',
    },
    providerPassword,
  );
  const providerId = providerAccount.providerProfile!.id;
  await prisma.providerProfile.update({
    where: { id: providerId },
    data: {
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verificationNotes: 'Compte de démonstration.',
    },
  });
  const provider = { accountId: providerAccount.id, providerId };

  const property = await createProperty(client.id, {
    name: 'Villa Mermoz (démo)',
    type: 'VILLA',
    commune: 'Dakar',
    quartier: 'Mermoz',
    landmark: 'Derrière la pharmacie (fictif)',
    surface: 180,
    levels: 2,
    bedrooms: 4,
    bathrooms: 3,
    yearBuilt: 2015,
  });
  const livingRoomAc = await createEquipment(client.id, property.id, {
    typeId: acType.id,
    name: 'Climatiseur salon',
    location: 'Salon',
    quantity: 1,
    brand: 'Marque fictive',
    lastServiceAt: date(-210),
  });
  await createEquipment(client.id, property.id, {
    typeId: acType.id,
    name: 'Climatiseur chambre parentale',
    location: 'Chambre 1',
    quantity: 1,
    lastServiceAt: date(-60),
  });

  // 1. Intervention complète, clôturée.
  const past = await createServiceRequest(
    client.id,
    {
      idempotencyKey: randomUUID(),
      propertyId: property.id,
      categoryId: category.id,
      equipmentId: livingRoomAc.id,
      description: 'Le climatiseur du salon souffle de l’air tiède depuis deux jours.',
      kind: 'QUICK_REPAIR',
      safetyAcknowledged: false,
    },
    [],
  );
  const pastRequest = await prisma.serviceRequest.findUniqueOrThrow({
    where: { reference: past.reference },
  });
  await assignProvider(admin.id, pastRequest.id, providerId);
  await respondToAssignment(provider, past.reference, true);
  const quote = await createQuote(provider, past.reference, {
    lines: [{ label: 'Recharge de gaz R410A', quantity: 1, unitPrice: 15_000 }],
    travelFee: 3_000,
    diagnosticFee: 0,
    laborAmount: 12_000,
    otherFees: 0,
    discountAmount: 0,
    taxAmount: 0,
    validityDays: 15,
    conditions: 'Intervention garantie 3 mois sur la main-d’œuvre (exemple fictif).',
  });
  await acceptQuote(client.id, quote.id);
  const appointment = await proposeAppointment(provider, past.reference, {
    type: 'INTERVENTION',
    date: date(1),
    startTime: '09:00',
    durationMinutes: 90,
    fee: 0,
  });
  await confirmAppointment(client.id, appointment.id);
  await advanceOnSite(provider, past.reference, 'ARRIVED');
  await advanceOnSite(provider, past.reference, 'IN_PROGRESS');
  await submitReport(
    provider,
    past.reference,
    {
      diagnostic: 'Filtres encrassés et charge de gaz insuffisante.',
      workDone:
        'Nettoyage des filtres et de l’unité intérieure, recharge de gaz, contrôle des pressions.',
      partsUsed: 'Gaz R410A (1 recharge)',
      recommendations: 'Nettoyer les filtres tous les mois pendant la saison chaude.',
      durationMinutes: 80,
      nextMaintenanceAt: date(180),
    },
    { before: [], after: [] },
  );
  await validateIntervention(client.id, past.reference, 'Tout fonctionne, merci.');
  await submitReview(client.id, past.reference, {
    rating: 5,
    quality: 5,
    punctuality: 4,
    price: 4,
    behaviour: 5,
    comment: 'Avis de démonstration (fictif).',
  });
  await adminTransition(admin.id, pastRequest.id, 'CLOSED', 'Clôture (démonstration)');

  // 2. Demande en cours : devis à valider par le client.
  const current = await createServiceRequest(
    client.id,
    {
      idempotencyKey: randomUUID(),
      propertyId: property.id,
      categoryId: category.id,
      description: 'Entretien annuel des deux climatiseurs avant la saison chaude.',
      kind: 'PLANNED',
      safetyAcknowledged: false,
    },
    [],
  );
  const currentRequest = await prisma.serviceRequest.findUniqueOrThrow({
    where: { reference: current.reference },
  });
  await assignProvider(admin.id, currentRequest.id, providerId);
  await respondToAssignment(provider, current.reference, true);
  await createQuote(provider, current.reference, {
    lines: [{ label: 'Entretien complet climatiseur', quantity: 2, unitPrice: 10_000 }],
    travelFee: 3_000,
    diagnosticFee: 0,
    laborAmount: 0,
    otherFees: 0,
    discountAmount: 2_000,
    taxAmount: 0,
    validityDays: 15,
  });

  console.info('Données de démonstration Kër Care créées (fictives).');
  console.info(`  Client       : ${CLIENT_EMAIL} / ${clientPassword}`);
  console.info(`  Prestataire  : ${PROVIDER_EMAIL} / ${providerPassword}`);
  console.info(
    `  Demandes     : ${past.reference} (clôturée), ${current.reference} (devis à valider)`,
  );
}

main()
  .catch((error) => {
    console.error(
      'Échec du seed de démonstration :',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
