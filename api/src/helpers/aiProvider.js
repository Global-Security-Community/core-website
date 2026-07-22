/**
 * AI Provider abstraction for text and image generation.
 *
 * Supports:
 *   - openai  → OpenAI API platform (default)
 *   - azure   → Azure AI Foundry
 *
 * Switch provider via the AI_PROVIDER env var.
 * Each provider reads its own set of env vars for credentials/models.
 */

// ─── Size helpers ───

const OPENAI_IMAGE_SIZES = ['1024x1024', '1024x1536', '1536x1024'];
const DALLE3_IMAGE_SIZES = ['1024x1024', '1024x1792', '1792x1024'];

function mapToClosestSize(requested, supported) {
  if (supported.includes(requested)) return requested;
  const [rw, rh] = requested.split('x').map(Number);
  let best = supported[0];
  let bestDist = Infinity;
  for (const s of supported) {
    const [sw, sh] = s.split('x').map(Number);
    const dist = Math.abs(rw - sw) + Math.abs(rh - sh);
    if (dist < bestDist) { bestDist = dist; best = s; }
  }
  return best;
}

// ─── OpenAI Provider ───

const openaiProvider = {
  name: 'openai',

  isConfigured() {
    return !!(process.env.OPENAI_API_KEY);
  },

  isChatConfigured() {
    return this.isConfigured();
  },

  isImageConfigured() {
    return this.isConfigured();
  },

  async chatCompletion(messages, { maxTokens = 250, temperature = 0.3 } = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Chat completion failed: ${response.status} ${errText}`);
    }

    const result = await response.json();
    return (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content || '').trim();
  },

  async generateImage(prompt, { size = '1024x1024' } = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

    const supportedSizes = model.startsWith('dall-e-3') ? DALLE3_IMAGE_SIZES : OPENAI_IMAGE_SIZES;
    const mappedSize = mapToClosestSize(size, supportedSizes);

    const body = { model, prompt, n: 1, size: mappedSize };

    // DALL-E models need explicit response_format
    if (model.startsWith('dall-e')) {
      body.response_format = 'b64_json';
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Image generation failed: ${response.status} ${errText}`);
    }

    const result = await response.json();
    const b64 = result.data && result.data[0] && result.data[0].b64_json;
    if (!b64) throw new Error('No image data in response');
    return Buffer.from(b64, 'base64');
  },

  async editImage(imageBuffer, prompt, { size = '1024x1024' } = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
    const form = createImageEditForm(imageBuffer, prompt, model, size);
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form
    });

    return await decodeImageResponse(response, 'Image edit');
  }
};

// ─── Azure AI Foundry Provider ───

const azureProvider = {
  name: 'azure',

  isConfigured() {
    return !!(
      (
        (process.env.AZURE_AI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT) &&
        (process.env.AZURE_AI_KEY || process.env.AZURE_OPENAI_API_KEY)
      ) ||
      (
        process.env.AZURE_OPENAI_IMAGE_ENDPOINT &&
        process.env.AZURE_OPENAI_IMAGE_API_KEY
      )
    );
  },

  isChatConfigured() {
    return !!(
      (process.env.AZURE_AI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT) &&
      (process.env.AZURE_AI_KEY || process.env.AZURE_OPENAI_API_KEY)
    );
  },

  isImageConfigured() {
    return !!(
      (process.env.AZURE_OPENAI_IMAGE_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_AI_ENDPOINT) &&
      (process.env.AZURE_OPENAI_IMAGE_API_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_AI_KEY)
    );
  },

  async chatCompletion(messages, { maxTokens = 250, temperature = 0.3 } = {}) {
    const endpoint = process.env.AZURE_AI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_AI_KEY || process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_AI_GPT_DEPLOYMENT || 'gpt-nano';

    const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-06-01`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Chat completion failed: ${response.status} ${errText}`);
    }

    const result = await response.json();
    return (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content || '').trim();
  },

  async generateImage(prompt, { size = '1024x1024' } = {}) {
    const endpoint = process.env.AZURE_OPENAI_IMAGE_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_AI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_IMAGE_API_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_AI_KEY;
    const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT ||
      process.env.AZURE_AI_IMAGE_DEPLOYMENT ||
      process.env.AZURE_AI_DEPLOYMENT ||
      'gpt-image-1';
    const apiVersion = process.env.AZURE_OPENAI_IMAGE_API_VERSION || '2025-04-01-preview';
    const mappedSize = mapToClosestSize(size, OPENAI_IMAGE_SIZES);
    const normalizedEndpoint = endpoint.replace(/\/+$/, '');
    const usesFoundryV1 = normalizedEndpoint.endsWith('/openai/v1/images/generations');
    const url = usesFoundryV1
      ? normalizedEndpoint
      : `${normalizedEndpoint}/openai/deployments/${encodeURIComponent(deployment)}/images/generations?api-version=${encodeURIComponent(apiVersion)}`;
    const body = {
      prompt,
      n: 1,
      size: mappedSize,
      quality: process.env.AZURE_OPENAI_IMAGE_QUALITY || 'medium',
      output_format: 'png'
    };
    if (usesFoundryV1) body.model = deployment;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Image generation failed: ${response.status} ${errText}`);
    }

    const result = await response.json();
    const b64 = result.data && result.data[0] && result.data[0].b64_json;
    if (!b64) throw new Error('No image data in response');
    return Buffer.from(b64, 'base64');
  },

  async editImage(imageBuffer, prompt, { size = '1024x1024' } = {}) {
    const endpoint = process.env.AZURE_OPENAI_IMAGE_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_AI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_IMAGE_API_KEY || process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_AI_KEY;
    const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT ||
      process.env.AZURE_AI_IMAGE_DEPLOYMENT ||
      process.env.AZURE_AI_DEPLOYMENT ||
      'gpt-image-1';
    const apiVersion = process.env.AZURE_OPENAI_IMAGE_API_VERSION || '2025-04-01-preview';
    const normalizedEndpoint = endpoint.replace(/\/+$/, '');
    const usesFoundryV1 = normalizedEndpoint.endsWith('/openai/v1/images/generations');
    const url = usesFoundryV1
      ? normalizedEndpoint.replace(/\/generations$/, '/edits')
      : `${normalizedEndpoint}/openai/deployments/${encodeURIComponent(deployment)}/images/edits?api-version=${encodeURIComponent(apiVersion)}`;
    const form = createImageEditForm(imageBuffer, prompt, usesFoundryV1 ? deployment : null, size);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': apiKey },
      body: form
    });

    return await decodeImageResponse(response, 'Image edit');
  }
};

function createImageEditForm(imageBuffer, prompt, model, size) {
  const form = new FormData();
  form.append('image', new Blob([imageBuffer], { type: 'image/png' }), 'annual-theme.png');
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', mapToClosestSize(size, OPENAI_IMAGE_SIZES));
  form.append('quality', process.env.AZURE_OPENAI_IMAGE_QUALITY || 'medium');
  form.append('output_format', 'png');
  if (model) form.append('model', model);
  return form;
}

async function decodeImageResponse(response, operation) {
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${operation} failed: ${response.status} ${errText}`);
  }

  const result = await response.json();
  const b64 = result.data && result.data[0] && result.data[0].b64_json;
  if (!b64) throw new Error(`No image data returned by ${operation.toLowerCase()}`);
  return Buffer.from(b64, 'base64');
}

// ─── Provider registry ───

const providers = { openai: openaiProvider, azure: azureProvider };

/**
 * Returns the active AI provider based on AI_PROVIDER env var.
 * Throws if the provider is unknown or not configured.
 */
function getProvider() {
  const name = process.env.AI_PROVIDER || 'openai';
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown AI provider: ${name}. Supported: ${Object.keys(providers).join(', ')}`);
  }
  if (!provider.isConfigured()) {
    throw new Error(`AI provider '${name}' is not configured. Check environment variables.`);
  }
  return provider;
}

/**
 * Returns true if the active provider has its credentials configured.
 */
function isConfigured() {
  const name = process.env.AI_PROVIDER || 'openai';
  const provider = providers[name];
  return provider ? provider.isConfigured() : false;
}

function isImageConfigured() {
  const name = process.env.AI_PROVIDER || 'openai';
  const provider = providers[name];
  return provider ? provider.isImageConfigured() : false;
}

function isChatConfigured() {
  const name = process.env.AI_PROVIDER || 'openai';
  const provider = providers[name];
  return provider ? provider.isChatConfigured() : false;
}

module.exports = { getProvider, isConfigured, isChatConfigured, isImageConfigured, providers };
