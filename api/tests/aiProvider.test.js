const { getProvider, isConfigured, isImageConfigured, providers } = require('../src/helpers/aiProvider');

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
      delete process.env.AZURE_OPENAI_ENDPOINT;
      delete process.env.AZURE_OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_IMAGE_ENDPOINT;
      delete process.env.AZURE_OPENAI_IMAGE_API_KEY;
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

    it('supports standard Azure OpenAI environment variable names', () => {
      process.env.AI_PROVIDER = 'azure';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      expect(isConfigured()).toBe(true);
    });

    it('supports separate image credentials without replacing chat credentials', () => {
      process.env.AI_PROVIDER = 'azure';
      process.env.AZURE_OPENAI_IMAGE_ENDPOINT = 'https://images.services.ai.azure.com/openai/v1/images/generations';
      process.env.AZURE_OPENAI_IMAGE_API_KEY = 'image-key';
      expect(isConfigured()).toBe(true);
      expect(isImageConfigured()).toBe(true);
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
      expect(typeof provider.editImage).toBe('function');
      expect(provider.name).toBe('openai');
    });

    it('azure provider has required methods', () => {
      const provider = providers.azure;
      expect(typeof provider.isConfigured).toBe('function');
      expect(typeof provider.chatCompletion).toBe('function');
      expect(typeof provider.generateImage).toBe('function');
      expect(typeof provider.editImage).toBe('function');
      expect(provider.name).toBe('azure');
    });
  });

  describe('Azure image generation', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('calls the GPT Image deployment API and decodes its base64 response', async () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT = 'gpt-image-production';
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('png-data').toString('base64') }]
        })
      });

      const result = await providers.azure.generateImage('badge artwork', { size: '1024x1024' });

      expect(result).toEqual(Buffer.from('png-data'));
      expect(fetchMock).toHaveBeenCalledWith(
        'https://test.openai.azure.com/openai/deployments/gpt-image-production/images/generations?api-version=2025-04-01-preview',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': 'test-key' }
        })
      );
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody).toMatchObject({
        prompt: 'badge artwork',
        size: '1024x1024',
        quality: 'medium',
        output_format: 'png'
      });
    });

    it('supports a full Foundry v1 images endpoint', async () => {
      process.env.AZURE_OPENAI_IMAGE_ENDPOINT = 'https://images.services.ai.azure.com/openai/v1/images/generations';
      process.env.AZURE_OPENAI_IMAGE_API_KEY = 'image-key';
      process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT = 'gpt-image-2';
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('image-2-data').toString('base64') }]
        })
      });

      await providers.azure.generateImage('shared badge');

      expect(fetchMock.mock.calls[0][0]).toBe('https://images.services.ai.azure.com/openai/v1/images/generations');
      expect(fetchMock.mock.calls[0][1].headers['api-key']).toBe('image-key');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
        model: 'gpt-image-2',
        prompt: 'shared badge'
      });
    });

    it('uses the Foundry v1 image edit endpoint with the annual theme as input', async () => {
      process.env.AZURE_OPENAI_IMAGE_ENDPOINT = 'https://images.services.ai.azure.com/openai/v1/images/generations';
      process.env.AZURE_OPENAI_IMAGE_API_KEY = 'image-key';
      process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT = 'gpt-image-2';
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('chapter-data').toString('base64') }]
        })
      });

      const result = await providers.azure.editImage(Buffer.from('annual-theme'), 'Add Perth landmarks');

      expect(result).toEqual(Buffer.from('chapter-data'));
      expect(fetchMock.mock.calls[0][0]).toBe('https://images.services.ai.azure.com/openai/v1/images/edits');
      expect(fetchMock.mock.calls[0][1].headers['api-key']).toBe('image-key');
      const requestBody = fetchMock.mock.calls[0][1].body;
      expect(requestBody).toBeInstanceOf(FormData);
      expect(requestBody.get('model')).toBe('gpt-image-2');
      expect(requestBody.get('prompt')).toBe('Add Perth landmarks');
      expect(requestBody.get('image')).toBeInstanceOf(Blob);
    });
  });
});
