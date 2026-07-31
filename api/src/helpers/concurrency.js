async function runInChunks(items, chunkSize, handler) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new RangeError('chunkSize must be a positive integer');
  }
  if (typeof handler !== 'function') throw new TypeError('handler must be a function');

  for (let index = 0; index < items.length; index += chunkSize) {
    await Promise.all(items.slice(index, index + chunkSize).map(item => handler(item)));
  }
}

module.exports = { runInChunks };
