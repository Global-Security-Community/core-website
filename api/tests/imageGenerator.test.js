const fs = require('fs');
const path = require('path');

const mockBlobs = new Map();
const mockPng = fs.readFileSync(path.join(__dirname, '../src/assets/badge-themes/2026-master.png'));
const mockGenerateImage = jest.fn().mockResolvedValue(mockPng);
const mockEditImage = jest.fn().mockResolvedValue(mockPng);

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: jest.fn().mockReturnValue({
      getContainerClient: jest.fn().mockReturnValue({
        createIfNotExists: jest.fn().mockResolvedValue({}),
        getBlockBlobClient: jest.fn().mockImplementation(path => ({
          url: `https://storage.test/generated-images/${path}`,
          exists: jest.fn().mockImplementation(async () => mockBlobs.has(path)),
          downloadToBuffer: jest.fn().mockImplementation(async () => mockBlobs.get(path)),
          uploadData: jest.fn().mockImplementation(async buffer => {
            mockBlobs.set(path, buffer);
          })
        }))
      })
    })
  }
}));

jest.mock('../src/helpers/aiProvider', () => ({
  getProvider: jest.fn().mockReturnValue({
    name: 'azure',
    generateImage: mockGenerateImage,
    editImage: mockEditImage
  }),
  isChatConfigured: jest.fn().mockReturnValue(false)
}));

jest.mock('../src/helpers/badgeGenerator', () => ({
  generateSharedEventBadgePng: jest.fn().mockImplementation(async (details, background) => (
    Buffer.from(`${details.badgeType}:${background.toString('utf8')}`)
  ))
}));

process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';

const { generateEventBadgeBackground } = require('../src/helpers/imageGenerator');

describe('annual community badge themes', () => {
  beforeEach(() => {
    mockBlobs.clear();
    mockGenerateImage.mockClear();
    mockEditImage.mockClear();
  });

  test('reuses one annual theme while caching a local variation per chapter', async () => {
    const first = await generateEventBadgeBackground(
      'Perth Security Day',
      'Perth',
      'perth',
      'perth-security-day',
      '2027-05-15'
    );
    const second = await generateEventBadgeBackground(
      'Perth Security Night',
      'Perth',
      'perth',
      'perth-security-night',
      '2027-08-18'
    );
    const third = await generateEventBadgeBackground(
      'Sydney Security Day',
      'Sydney',
      'sydney',
      'sydney-security-day',
      '2027-09-20'
    );

    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    expect(mockEditImage).toHaveBeenCalledTimes(2);
    expect(first).toMatchObject({ themeYear: 2027, themeCreated: true, chapterThemeCreated: true });
    expect(second).toMatchObject({ themeYear: 2027, themeCreated: false, chapterThemeCreated: false });
    expect(third).toMatchObject({ themeYear: 2027, themeCreated: false, chapterThemeCreated: true });
    expect(mockBlobs.get('badge-themes/2027.png')).toEqual(mockPng);
    expect(mockBlobs.get('badge-themes/2027/chapters/perth.png')).toEqual(mockPng);
    expect(mockBlobs.get('badge-themes/2027/chapters/sydney.png')).toEqual(mockPng);
    expect(mockBlobs.has('badge-themes/2027/chapters/perth-card.webp')).toBe(true);
    expect(mockBlobs.has('badge-themes/2027/chapters/sydney-card.webp')).toBe(true);
    expect(mockBlobs.has('events/perth-security-day-attendee.png')).toBe(true);
    expect(mockBlobs.has('events/perth-security-night-attendee.png')).toBe(true);
    expect(mockBlobs.has('events/sydney-security-day-speaker.png')).toBe(true);
    expect(mockBlobs.has('events/sydney-security-day-organiser.png')).toBe(true);
  });
});
