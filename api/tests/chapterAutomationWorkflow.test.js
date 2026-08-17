const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../..');
const generateWorkflow = fs.readFileSync(
  path.join(repositoryRoot, '.github/workflows/generate-chapter.yml'),
  'utf8'
);
const validateWorkflow = fs.readFileSync(
  path.join(repositoryRoot, '.github/workflows/validate-release-source.yml'),
  'utf8'
);

describe('chapter automation workflow contracts', () => {
  test('serializes generation by chapter and no longer requests a second approval', () => {
    expect(generateWorkflow).toContain(
      'group: generate-chapter-${{ github.event.client_payload.chapter_slug }}'
    );
    expect(generateWorkflow).not.toContain('Approve production release');
    expect(generateWorkflow).not.toContain('/api/releaseApproval');
  });

  test('creates an isolated protected production pull request', () => {
    expect(generateWorkflow).toContain('--base live-version-swa');
    expect(generateWorkflow).toContain('auto/release-chapter-${SLUG}-${GITHUB_RUN_ID}');
    expect(generateWorkflow).toContain('<!-- automated-chapter-release -->');
    expect(generateWorkflow).toContain('git checkout "$SOURCE_SHA" -- "$CHAPTER_PATH"');
  });

  test('validates the automated release source and exact file scope', () => {
    expect(validateWorkflow).toContain('git merge-base --is-ancestor "$SOURCE_SHA" origin/main');
    expect(validateWorkflow).toContain(
      'Automated chapter releases may change only ${CHAPTER_PATH}'
    );
    expect(validateWorkflow).toContain(
      'cmp --silent /tmp/source-chapter "$CHAPTER_PATH"'
    );
  });

  test('waits for production deployment and reports success or failure', () => {
    expect(generateWorkflow).toContain(
      '--workflow azure-static-web-apps-lively-desert-0f1f18c10.yml'
    );
    expect(generateWorkflow).toContain('if: success()');
    expect(generateWorkflow).toContain('if: failure()');
  });
});
