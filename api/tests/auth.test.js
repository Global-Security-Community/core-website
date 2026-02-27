const { getAuthUser, hasRole, unauthorised, forbidden } = require('../src/helpers/auth');

describe('auth helper', () => {
  describe('getAuthUser', () => {
    test('returns null when no header present', () => {
      const request = { headers: { get: () => null } };
      expect(getAuthUser(request)).toBeNull();
    });

    test('decodes valid client principal', () => {
      const principal = {
        userId: 'user-123',
        userDetails: 'test@example.com',
        userRoles: ['authenticated', 'admin'],
        identityProvider: 'ciam'
      };
      const encoded = Buffer.from(JSON.stringify(principal)).toString('base64');
      const request = { headers: { get: (h) => h === 'x-ms-client-principal' ? encoded : null } };

      const user = getAuthUser(request);
      expect(user).not.toBeNull();
      expect(user.userId).toBe('user-123');
      expect(user.userDetails).toBe('test@example.com');
      expect(user.userRoles).toContain('admin');
      expect(user.identityProvider).toBe('ciam');
    });

    test('returns null for invalid base64', () => {
      const request = { headers: { get: (h) => h === 'x-ms-client-principal' ? '!!!notbase64' : null } };
      expect(getAuthUser(request)).toBeNull();
    });

    test('normalises roles to lowercase', () => {
      const principal = { userId: 'u1', userDetails: 'x', userRoles: ['Admin', 'Authenticated'] };
      const encoded = Buffer.from(JSON.stringify(principal)).toString('base64');
      const request = { headers: { get: (h) => h === 'x-ms-client-principal' ? encoded : null } };
      const user = getAuthUser(request);
      expect(user.userRoles).toEqual(['admin', 'authenticated']);
    });
  });

  describe('hasRole', () => {
    test('returns true when user has role', () => {
      expect(hasRole({ userRoles: ['admin', 'authenticated'] }, 'admin')).toBe(true);
    });

    test('returns false when user lacks role', () => {
      expect(hasRole({ userRoles: ['authenticated'] }, 'admin')).toBe(false);
    });

    test('is case-insensitive', () => {
      expect(hasRole({ userRoles: ['admin'] }, 'Admin')).toBe(true);
    });

    test('returns false for null user', () => {
      expect(hasRole(null, 'admin')).toBe(false);
    });
  });

  describe('unauthorised', () => {
    test('returns 401 status', () => {
      const res = unauthorised();
      expect(res.status).toBe(401);
    });

    test('returns custom message', () => {
      const res = unauthorised('Please log in');
      expect(JSON.parse(res.body).error).toBe('Please log in');
    });
  });

  describe('forbidden', () => {
    test('returns 403 status', () => {
      const res = forbidden();
      expect(res.status).toBe(403);
    });
  });
});
