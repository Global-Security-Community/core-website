const { getProvider, isConfigured, providers } = require('../src/helpers/aiProvider');

describe('aiProvider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('isConfigured', () => {
    it('returns false when no provider credentials are set', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AZURE_AI_ENDPOINT;
      delete process.env.AZURE_AI_KEY;
      process.env.AI_PROVIDER = 'openai';
      expect(isConfigured()).toBe(false);
    });

    it('returns true when OpenAI key is set and provider is openai', () => {
      process.env.AI_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'sk-test';
      expect(isConfigured()).toBe(true);
    });

    it('returns true when Azure credentials are set and provider is azure', () => {
      process.env.AI_PROVIDER = 'azure';
      process.env.AZURE_AI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_AI_KEY = 'test-key';
      expect(isConfigured()).toBe(true);
    });

    it('returns false when provider is azure but credentials missing', () => {
      process.env.AI_PROVIDER = 'azure';
      delete process.env.AZURE_AI_ENDPOINT;
      delete process.env.AZURE_AI_KEY;
      expect(isConfigured()).toBe(false);
    });

    it('returns false for unknown provider', () => {
      process.env.AI_PROVIDER = 'unknown';
      expect(isConfigured()).toBe(false);
    });

    it('defaults to openai when AI_PROVIDER is not set', () => {
      delete process.env.AI_PROVIDER;
      process.env.OPENAI_API_KEY = 'sk-test';
      expect(isConfigured()).toBe(true);
    });
  });

  describe('getProvider', () => {
    it('returns openai provider when configured', () => {
      process.env.AI_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'sk-test';
      const provider = getProvider();
      expect(provider.name).toBe('openai');
    });

    it('returns azure provider when configured', () => {
      process.env.AI_PROVIDER = 'azure';
      process.env.AZURE_AI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_AI_KEY = 'test-key';
      const provider = getProvider();
      expect(provider.name).toBe('azure');
    });

    it('throws for unknown provider', () => {
      process.env.AI_PROVIDER = 'unknown';
      expect(() => getProvider()).toThrow('Unknown AI provider: unknown');
    });

    it('throws when provider credentials are missing', () => {
      process.env.AI_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;
      expect(() => getProvider()).toThrow("AI provider 'openai' is not configured");
    });
  });

  describe('provider interface', () => {
    it('openai provider has required methods', () => {
      const provider = providers.openai;
      expect(typeof provider.isConfigured).toBe('function');
      expect(typeof provider.chatCompletion).toBe('function');
      expect(typeof provider.generateImage).toBe('function');
      expect(provider.name).toBe('openai');
    });

    it('azure provider has required methods', () => {
      const provider = providers.azure;
      expect(typeof provider.isConfigured).toBe('function');
      expect(typeof provider.chatCompletion).toBe('function');
      expect(typeof provider.generateImage).toBe('function');
      expect(provider.name).toBe('azure');
    });
  });
});
