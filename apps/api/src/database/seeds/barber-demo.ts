import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import dataSource from '../data-source.js';
import { Organization } from '../../organizations/organization.entity.js';
import { OrganizationMembership } from '../../organizations/organization-membership.entity.js';
import { OrganizationModule } from '../../organizations/organization-module.entity.js';
import { User } from '../../users/user.entity.js';
import {
  BarberBusinessProfile,
  BarberClient,
  BarberProfessional,
  BarberProfessionalService,
  BarberService,
} from '../../barber/barber.entities.js';

const demoOrganizationSlug = 'barber-demo';
const identities = [
  { email: 'owner@barber-demo.example.test', role: 'owner' as const },
  { email: 'admin@barber-demo.example.test', role: 'admin' as const },
  { email: 'professional@barber-demo.example.test', role: 'member' as const },
  { email: 'client@barber-demo.example.test', role: 'customer' as const },
];

function makePassword() {
  return randomBytes(18).toString('base64url');
}

async function run() {
  const environment = process.env.NODE_ENV?.toLowerCase();
  if (![undefined, 'development', 'test'].includes(environment))
    throw new Error(
      'Demo accounts are allowed only in local development or test environments.',
    );
  const resetPasswords = process.argv.includes('--reset-passwords');
  const showCredentials = process.argv.includes('--show-credentials');
  if (resetPasswords && !showCredentials)
    throw new Error(
      'Password reset requires --show-credentials so the new passwords can be saved once.',
    );
  await dataSource.initialize();
  const credentials: Array<{ email: string; password: string }> = [];
  try {
    await dataSource.transaction(async (manager) => {
      const organizations = manager.getRepository(Organization);
      const users = manager.getRepository(User);
      const memberships = manager.getRepository(OrganizationMembership);
      const modules = manager.getRepository(OrganizationModule);
      const professionals = manager.getRepository(BarberProfessional);
      const services = manager.getRepository(BarberService);
      const profileRepo = manager.getRepository(BarberBusinessProfile);
      const clients = manager.getRepository(BarberClient);
      const joins = manager.getRepository(BarberProfessionalService);

      let organization = await organizations.findOne({
        where: { slug: demoOrganizationSlug },
      });
      if (!organization)
        organization = await organizations.save(
          organizations.create({
            name: 'Barber Demo Lisboa',
            slug: demoOrganizationSlug,
            description: 'Organização local para demonstração do Barber.',
            contactEmail: 'contact@barber-demo.example.test',
            phone: '+351 210 000 000',
            country: 'Portugal',
            industry: 'Barber',
            isActive: true,
            deactivatedAt: null,
            logoUrl: null,
            website: null,
            taxId: null,
          }),
        );
      const savedUsers: Record<string, User> = {};
      for (const identity of identities) {
        let user = await users.findOne({
          where: { email: identity.email },
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            platformRole: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (!user || resetPasswords) {
          const password = makePassword();
          const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
          });
          if (user) {
            user.passwordHash = passwordHash;
            user.emailVerifiedAt = new Date();
            user.isActive = true;
            user = await users.save(user);
            if (resetPasswords) {
              await manager.query(
                'UPDATE "auth_sessions" SET "revoked_at" = now() WHERE "user_id" = $1 AND "revoked_at" IS NULL',
                [user.id],
              );
            }
          } else {
            user = await users.save(
              users.create({
                email: identity.email,
                passwordHash,
                emailVerifiedAt: new Date(),
                platformRole: 'none',
                isActive: true,
              }),
            );
          }
          credentials.push({ email: identity.email, password });
        }
        savedUsers[identity.role] = user;
        if (identity.role !== 'customer') {
          let membership = await memberships.findOne({
            where: { userId: user.id, organizationId: organization.id },
          });
          const permissions =
            identity.role === 'member' ? ['barber:read', 'barber:write'] : [];
          if (!membership)
            membership = memberships.create({
              userId: user.id,
              organizationId: organization.id,
              role: identity.role,
              permissions,
            });
          membership.role = identity.role;
          membership.permissions = permissions;
          await memberships.save(membership);
        }
      }
      const module = await modules.findOne({
        where: { organizationId: organization.id, key: 'barber' },
      });
      if (module) {
        module.enabled = true;
        await modules.save(module);
      } else
        await modules.save(
          modules.create({
            organizationId: organization.id,
            key: 'barber',
            enabled: true,
            updatedByUserId: savedUsers.owner.id,
          }),
        );

      let profile = await profileRepo.findOne({
        where: { organizationId: organization.id },
      });
      if (!profile)
        profile = profileRepo.create({
          organizationId: organization.id,
          businessName: 'Barber Demo Lisboa',
          description: 'Demonstração do módulo Barber.',
          email: 'contact@barber-demo.example.test',
          phone: '+351 210 000 000',
          address: 'Lisboa, Portugal',
          timezone: 'Europe/Lisbon',
        });
      await profileRepo.save(profile);

      let professional = await professionals.findOne({
        where: {
          organizationId: organization.id,
          userId: savedUsers.member.id,
        },
      });
      if (!professional)
        professional = professionals.create({
          organizationId: organization.id,
          userId: savedUsers.member.id,
          createdByUserId: savedUsers.owner.id,
          displayName: 'Alex Silva',
          bio: 'Barbeiro demonstrativo.',
          email: savedUsers.member.email,
          phone: '+351 910 000 001',
          isActive: true,
        });
      await professionals.save(professional);

      const serviceInputs = [
        {
          name: 'Corte clássico',
          description: 'Corte à tesoura ou máquina.',
          priceCents: 1800,
          durationMinutes: 30,
        },
        {
          name: 'Barba',
          description: 'Aparar e finalizar a barba.',
          priceCents: 1200,
          durationMinutes: 20,
        },
        {
          name: 'Corte e barba',
          description: 'Serviço combinado.',
          priceCents: 2700,
          durationMinutes: 50,
        },
      ];
      for (const input of serviceInputs) {
        let service = await services.findOne({
          where: { organizationId: organization.id, name: input.name },
        });
        if (!service)
          service = services.create({
            ...input,
            organizationId: organization.id,
            createdByUserId: savedUsers.owner.id,
            isActive: true,
          });
        await services.save(service);
        if (
          !(await joins.exists({
            where: {
              organizationId: organization.id,
              professionalId: professional.id,
              serviceId: service.id,
            },
          }))
        ) {
          await joins.save(
            joins.create({
              organizationId: organization.id,
              professionalId: professional.id,
              serviceId: service.id,
            }),
          );
        }
      }
      const customerUser = savedUsers.customer;
      if (!(await clients.exists({ where: { userId: customerUser.id } }))) {
        await clients.save(
          clients.create({
            organizationId: organization.id,
            createdByUserId: savedUsers.owner.id,
            userId: customerUser.id,
            responsibleProfessionalId: professional.id,
            fullName: 'Cliente Demonstração',
            phone: '+351 910 000 099',
            email: customerUser.email,
          }),
        );
      }
      if (
        !(await clients.exists({
          where: { organizationId: organization.id, fullName: 'Rita Martins' },
        }))
      ) {
        await clients.save(
          clients.create({
            organizationId: organization.id,
            createdByUserId: savedUsers.owner.id,
            responsibleProfessionalId: professional.id,
            fullName: 'Rita Martins',
            phone: '+351 910 000 098',
            email: 'rita@example.test',
          }),
        );
      }
    });
  } finally {
    await dataSource.destroy();
  }
  console.log(`Demo organization: ${demoOrganizationSlug}`);
  console.log(
    `Demo seed completed; ${demoOrganizationSlug} was created or updated idempotently.`,
  );
  if (showCredentials) {
    console.log(
      'One-time credentials (passwords are stored only as argon2id hashes):',
    );
    for (const item of credentials)
      console.log(`${item.email}\t${item.password}`);
    if (!credentials.length)
      console.log(
        'No passwords changed. Use --reset-passwords to rotate them.',
      );
  } else {
    console.log(
      `${credentials.length} passwords created or reset; use --show-credentials on the same run to display credentials.`,
    );
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo seed failed.');
  process.exitCode = 1;
});
