const { runInChunks } = require('../src/helpers/concurrency');

describe('runInChunks', () => {
  test('limits concurrent work while processing every item', async () => {
    let active = 0;
    let maximumActive = 0;
    const completed = [];

    await runInChunks([1, 2, 3, 4, 5, 6, 7], 3, async item => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise(resolve => setImmediate(resolve));
      completed.push(item);
      active--;
    });

    expect(maximumActive).toBe(3);
    expect(completed.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('stops before starting another chunk when a handler rejects', async () => {
    const started = [];

    await expect(runInChunks([1, 2, 3], 2, async item => {
      started.push(item);
      if (item === 2) throw new Error('failed');
    })).rejects.toThrow('failed');

    expect(started).toEqual([1, 2]);
  });

  test.each([
    [null, 1, async () => {}],
    [[], 0, async () => {}],
    [[], 1.5, async () => {}],
    [[], 1, null]
  ])('rejects invalid arguments', async (items, chunkSize, handler) => {
    await expect(runInChunks(items, chunkSize, handler)).rejects.toThrow();
  });
});
