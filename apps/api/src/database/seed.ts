import { PrismaClient } from '@prisma/client';
import { PasswordHasher } from '../auth/password-hasher';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_MIGRATOR_URL || process.env.DATABASE_SYSTEM_URL || process.env.DATABASE_APP_URL,
    },
  },
});

export async function seedDatabase(client: any = prisma) {
  console.log('🌱 Starting deterministic CRM multi-tenant seeding...');

  // 1. Password Hashing (Argon2id)
  const defaultPasswordHash = await PasswordHasher.hash('Password123!');

  // 2. Organization Bootstrap
  const acmeId = '018f4a12-0000-7000-8000-000000000001';
  const acmeOrg = await client.organization.upsert({
    where: { slug: 'acme-corp' },
    update: { name: 'Acme Corporation' },
    create: {
      id: acmeId,
      name: 'Acme Corporation',
      slug: 'acme-corp',
      status: 'active',
      legalHold: false,
    },
  });

  const globexId = '018f4a12-0000-7000-8000-000000000002';
  await client.organization.upsert({
    where: { slug: 'globex-inc' },
    update: { name: 'Globex Corporation' },
    create: {
      id: globexId,
      name: 'Globex Corporation',
      slug: 'globex-inc',
      status: 'active',
      legalHold: false,
    },
  });

  // 3. User Accounts Bootstrap
  const aliceId = '018f4a12-0000-7000-8000-000000000011';
  const alice = await client.user.upsert({
    where: { email: 'admin@acme.com' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: aliceId,
      email: 'admin@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Alice',
      lastName: 'Admin',
      isSuperadmin: true,
    },
  });

  const bobId = '018f4a12-0000-7000-8000-000000000012';
  const bob = await client.user.upsert({
    where: { email: 'sales@acme.com' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: bobId,
      email: 'sales@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Bob',
      lastName: 'Representative',
      isSuperadmin: false,
    },
  });

  const audreyId = '018f4a12-0000-7000-8000-000000000013';
  const audrey = await client.user.upsert({
    where: { email: 'auditor@acme.com' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: audreyId,
      email: 'auditor@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Audrey',
      lastName: 'Auditor',
      isSuperadmin: false,
    },
  });

  // 4. Organization Memberships
  await client.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: acmeOrg.id,
        userId: alice.id,
      },
    },
    update: { role: 'owner', status: 'active' },
    create: {
      id: '018f4a12-0000-7000-8000-000000000021',
      tenantId: acmeOrg.id,
      userId: alice.id,
      role: 'owner',
      status: 'active',
      sessionVersion: 1,
    },
  });

  await client.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: acmeOrg.id,
        userId: bob.id,
      },
    },
    update: { role: 'member', status: 'active' },
    create: {
      id: '018f4a12-0000-7000-8000-000000000022',
      tenantId: acmeOrg.id,
      userId: bob.id,
      role: 'member',
      status: 'active',
      sessionVersion: 1,
    },
  });

  await client.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: acmeOrg.id,
        userId: audrey.id,
      },
    },
    update: { role: 'read_only', status: 'active' },
    create: {
      id: '018f4a12-0000-7000-8000-000000000023',
      tenantId: acmeOrg.id,
      userId: audrey.id,
      role: 'read_only',
      status: 'active',
      sessionVersion: 1,
    },
  });

  // 5. Tenant Quotas
  await client.tenantQuota.upsert({
    where: {
      tenantId_metric: {
        tenantId: acmeOrg.id,
        metric: 'active_deals',
      },
    },
    update: { maxLimit: 100, currentCount: 3 },
    create: {
      tenantId: acmeOrg.id,
      metric: 'active_deals',
      maxLimit: 100,
      currentCount: 3,
    },
  });

  // 6. Pipelines & Deal Stages
  const directPipelineId = '018f4a12-0000-7000-8000-000000000031';
  const directPipeline = await client.pipeline.upsert({
    where: { id: directPipelineId },
    update: { name: 'Direct Enterprise Pipeline', isDefault: true },
    create: {
      id: directPipelineId,
      tenantId: acmeOrg.id,
      name: 'Direct Enterprise Pipeline',
      isDefault: true,
    },
  });

  const partnerPipelineId = '018f4a12-0000-7000-8000-000000000032';
  await client.pipeline.upsert({
    where: { id: partnerPipelineId },
    update: { name: 'Channel Partners Pipeline', isDefault: false },
    create: {
      id: partnerPipelineId,
      tenantId: acmeOrg.id,
      name: 'Channel Partners Pipeline',
      isDefault: false,
    },
  });

  // Direct Pipeline Stages
  const stagesData = [
    { id: '018f4a12-0000-7000-8000-000000000041', name: 'Lead Qualified', order: 0, prob: 20, won: false, lost: false },
    { id: '018f4a12-0000-7000-8000-000000000042', name: 'Discovery & Demo', order: 1, prob: 40, won: false, lost: false },
    { id: '018f4a12-0000-7000-8000-000000000043', name: 'Proposal Sent', order: 2, prob: 60, won: false, lost: false },
    { id: '018f4a12-0000-7000-8000-000000000044', name: 'Negotiation', order: 3, prob: 80, won: false, lost: false },
    { id: '018f4a12-0000-7000-8000-000000000045', name: 'Closed Won', order: 4, prob: 100, won: true, lost: false },
    { id: '018f4a12-0000-7000-8000-000000000046', name: 'Closed Lost', order: 5, prob: 0, won: false, lost: true },
  ];

  for (const s of stagesData) {
    await client.dealStage.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        displayOrder: s.order,
        probabilityPercentage: s.prob,
        isWon: s.won,
        isLost: s.lost,
      },
      create: {
        id: s.id,
        tenantId: acmeOrg.id,
        pipelineId: directPipeline.id,
        name: s.name,
        displayOrder: s.order,
        probabilityPercentage: s.prob,
        isWon: s.won,
        isLost: s.lost,
      },
    });
  }

  // 7. Accounts
  const cyberdyneId = '018f4a12-0000-7000-8000-000000000051';
  const cyberdyne = await client.account.upsert({
    where: { id: cyberdyneId },
    update: { name: 'Cyberdyne Systems' },
    create: {
      id: cyberdyneId,
      tenantId: acmeOrg.id,
      ownerId: bob.id,
      name: 'Cyberdyne Systems',
      domain: 'cyberdyne.com',
      industry: 'Robotics & AI',
      annualRevenue: '25000000.00',
    },
  });

  const starkId = '018f4a12-0000-7000-8000-000000000052';
  const stark = await client.account.upsert({
    where: { id: starkId },
    update: { name: 'Stark Industries' },
    create: {
      id: starkId,
      tenantId: acmeOrg.id,
      ownerId: bob.id,
      name: 'Stark Industries',
      domain: 'starkindustries.com',
      industry: 'Clean Energy & Defense',
      annualRevenue: '85000000.00',
    },
  });

  const wayneId = '018f4a12-0000-7000-8000-000000000053';
  const wayne = await client.account.upsert({
    where: { id: wayneId },
    update: { name: 'Wayne Enterprises' },
    create: {
      id: wayneId,
      tenantId: acmeOrg.id,
      ownerId: alice.id,
      name: 'Wayne Enterprises',
      domain: 'wayneenterprises.com',
      industry: 'Industrial Conglomerate',
      annualRevenue: '120000000.00',
    },
  });

  // 8. Contacts
  const sarahId = '018f4a12-0000-7000-8000-000000000061';
  const sarah = await client.contact.upsert({
    where: { id: sarahId },
    update: { firstName: 'Sarah', lastName: 'Connor' },
    create: {
      id: sarahId,
      tenantId: acmeOrg.id,
      accountId: cyberdyne.id,
      ownerId: bob.id,
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 's.connor@cyberdyne.com',
      phone: '+1-555-0199',
      jobTitle: 'Director of Operational Security',
    },
  });

  const tonyId = '018f4a12-0000-7000-8000-000000000062';
  const tony = await client.contact.upsert({
    where: { id: tonyId },
    update: { firstName: 'Tony', lastName: 'Stark' },
    create: {
      id: tonyId,
      tenantId: acmeOrg.id,
      accountId: stark.id,
      ownerId: bob.id,
      firstName: 'Tony',
      lastName: 'Stark',
      email: 'tony@starkindustries.com',
      phone: '+1-555-0123',
      jobTitle: 'Chief Technology Officer',
    },
  });

  const luciusId = '018f4a12-0000-7000-8000-000000000063';
  const lucius = await client.contact.upsert({
    where: { id: luciusId },
    update: { firstName: 'Lucius', lastName: 'Fox' },
    create: {
      id: luciusId,
      tenantId: acmeOrg.id,
      accountId: wayne.id,
      ownerId: alice.id,
      firstName: 'Lucius',
      lastName: 'Fox',
      email: 'l.fox@wayneenterprises.com',
      phone: '+1-555-0144',
      jobTitle: 'VP Enterprise Technologies',
    },
  });

  // 9. Deals
  const deal1Id = '018f4a12-0000-7000-8000-000000000071';
  const deal1 = await client.deal.upsert({
    where: { id: deal1Id },
    update: { title: 'Autonomous Defense Platform License' },
    create: {
      id: deal1Id,
      tenantId: acmeOrg.id,
      pipelineId: directPipeline.id,
      stageId: stagesData[2].id, // Proposal Sent
      accountId: cyberdyne.id,
      primaryContactId: sarah.id,
      ownerId: bob.id,
      title: 'Autonomous Defense Platform License',
      value: '150000.00',
      currency: 'USD',
      version: 1,
    },
  });

  const deal2Id = '018f4a12-0000-7000-8000-000000000072';
  await client.deal.upsert({
    where: { id: deal2Id },
    update: { title: 'Arc Reactor Clean Grid Software Integration' },
    create: {
      id: deal2Id,
      tenantId: acmeOrg.id,
      pipelineId: directPipeline.id,
      stageId: stagesData[0].id, // Lead Qualified
      accountId: stark.id,
      primaryContactId: tony.id,
      ownerId: bob.id,
      title: 'Arc Reactor Clean Grid Software Integration',
      value: '420000.00',
      currency: 'USD',
      version: 1,
    },
  });

  const deal3Id = '018f4a12-0000-7000-8000-000000000073';
  await client.deal.upsert({
    where: { id: deal3Id },
    update: { title: 'Tactical Mobility Enterprise Suite' },
    create: {
      id: deal3Id,
      tenantId: acmeOrg.id,
      pipelineId: directPipeline.id,
      stageId: stagesData[4].id, // Closed Won
      accountId: wayne.id,
      primaryContactId: lucius.id,
      ownerId: alice.id,
      title: 'Tactical Mobility Enterprise Suite',
      value: '95000.00',
      currency: 'USD',
      version: 1,
    },
  });

  // 10. Sample Activity Timeline
  await client.activity.create({
    data: {
      tenantId: acmeOrg.id,
      type: 'note',
      subject: 'Executive Demo with Sarah Connor',
      body: 'Presented autonomous system safeguards. Client requested security architecture whitepaper.',
      dealId: deal1.id,
      contactId: sarah.id,
      accountId: cyberdyne.id,
      createdById: bob.id,
    },
  });

  console.log(`
✅ CRM Database Seeding Completed Successfully!

============================================================
CREDENTIALS SUMMARY (Local Development & Demo)
============================================================
Organization:  Acme Corporation (Slug: acme-corp)
Password:      Password123! (Argon2id for all users)

Users:
1. Alice Admin (Owner)
   Email: admin@acme.com
   Permissions: Full Organization Administration & Quotas

2. Bob Representative (Sales Rep)
   Email: sales@acme.com
   Permissions: Manage Accounts, Contacts, Deals & Timeline

3. Audrey Auditor (Read-Only)
   Email: auditor@acme.com
   Permissions: Audit Logs & Read-Only Domain Inspection

Pipelines:
- Direct Enterprise Pipeline (Default, 6 Stages)
- Channel Partners Pipeline (3 Stages)

Accounts & Deals:
- Cyberdyne Systems ($150,000 in Proposal Sent)
- Stark Industries ($420,000 in Lead Qualified)
- Wayne Enterprises ($95,000 in Closed Won)
============================================================
`);
}

// Execute standalone if called directly
if (require.main === module) {
  seedDatabase()
    .catch((err) => {
      console.error('Fatal Seeder Exception:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
