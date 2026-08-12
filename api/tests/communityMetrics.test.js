jest.mock('../src/helpers/tableStorage', () => ({
  listEvents: jest.fn(),
  countRegistrationsForEvents: jest.fn()
}));

const storage = require('../src/helpers/tableStorage');
const communityMetrics = require('../src/functions/communityMetrics');

describe('communityMetrics', () => {
  const context = { log: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns cached aggregate counts for public events', async () => {
    storage.listEvents.mockResolvedValue([
      { rowKey: 'event-1', status: 'published' },
      { rowKey: 'event-2', status: 'completed' },
      { rowKey: 'event-3', status: 'closed' },
      { rowKey: 'event-4', status: 'draft' }
    ]);
    storage.countRegistrationsForEvents.mockResolvedValue(147);

    const response = await communityMetrics({}, context);

    expect(storage.countRegistrationsForEvents).toHaveBeenCalledWith([
      'event-1', 'event-2', 'event-3'
    ]);
    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({
      eventsHosted: 3,
      totalRegistrations: 147
    });
    expect(response.headers['Cache-Control']).toContain('max-age=300');
  });

  test('surfaces storage failures without success-shaped data', async () => {
    storage.listEvents.mockRejectedValue(new Error('storage unavailable'));

    const response = await communityMetrics({}, context);

    expect(response.status).toBe(500);
    expect(response.jsonBody).toEqual({ error: 'Unable to load community metrics' });
    expect(context.log).toHaveBeenCalledWith(
      expect.stringContaining('storage unavailable')
    );
  });
});
