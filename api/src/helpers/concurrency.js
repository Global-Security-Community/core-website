async function runInChunks(items, chunkSize, handler) {
  for (let index = 0; index < items.length; index += chunkSize) {
    await Promise.all(items.slice(index, index + chunkSize).map(handler));
  }
}

module.exports = { runInChunks };
