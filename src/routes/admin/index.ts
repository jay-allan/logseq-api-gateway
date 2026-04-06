import type { FastifyInstance } from 'fastify';
import usersRoute from './users';
import rolesRoute from './roles';
import queueRoute from './queue';

export default async function adminRoutes(
    app: FastifyInstance
): Promise<void> {
    await app.register(usersRoute);
    await app.register(rolesRoute);
    await app.register(queueRoute);
}
