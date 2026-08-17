describe('Discord chapter channel creation', () => {
  const context = { log: jest.fn() };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.DISCORD_GUILD_ID = 'guild-1';
    process.env.DISCORD_CHAPTERS_CATEGORY_ID = 'category-1';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.DISCORD_GUILD_ID;
    delete process.env.DISCORD_CHAPTERS_CATEGORY_ID;
    delete global.fetch;
  });

  test('reuses an existing chapter channel', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{
        id: 'channel-1',
        name: 'canberra',
        type: 0,
        parent_id: 'category-1'
      }]
    });
    const { createChapterChannel } = require('../src/helpers/discordBot');

    const result = await createChapterChannel('Canberra', context);

    expect(result).toEqual({ channelId: 'channel-1', channelName: 'canberra' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('creates and welcomes a chapter when no channel exists', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'channel-2', name: 'canberra' })
      })
      .mockResolvedValueOnce({ ok: true });
    const { createChapterChannel } = require('../src/helpers/discordBot');

    const result = await createChapterChannel('Canberra', context);

    expect(result).toEqual({ channelId: 'channel-2', channelName: 'canberra' });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[1][0]).toContain('/guilds/guild-1/channels');
    expect(global.fetch.mock.calls[2][0]).toContain('/channels/channel-2/messages');
  });
});
