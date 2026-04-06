import { hashPassword, verifyPassword } from './password';

describe('hashPassword', () => {
    it('returns a bcrypt hash string', async () => {
        const hash = await hashPassword('mysecret');
        expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('produces a different hash each call (salt is random)', async () => {
        const a = await hashPassword('same');
        const b = await hashPassword('same');
        expect(a).not.toBe(b);
    });
});

describe('verifyPassword', () => {
    it('returns true for the correct password', async () => {
        const hash = await hashPassword('correct');
        await expect(verifyPassword('correct', hash)).resolves.toBe(true);
    });

    it('returns false for an incorrect password', async () => {
        const hash = await hashPassword('correct');
        await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
    });

    it('returns false for an empty password against a real hash', async () => {
        const hash = await hashPassword('notempty');
        await expect(verifyPassword('', hash)).resolves.toBe(false);
    });
});
