async function dispatchWithRetry(octokit, request) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await octokit.repos.createDispatchEvent(request);
      return;
    } catch (error) {
      const retryable = error.status === 429 || error.status >= 500 || !error.status;
      if (attempt === 3 || !retryable) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 250));
    }
  }
}

module.exports = { dispatchWithRetry };
