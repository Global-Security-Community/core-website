process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';

const mockGetEntity = jest.fn();
const mockUpdateEntity = jest.fn();

jest.mock('@azure/data-tables', () => ({
  TableClient: {
    fromConnectionString: jest.fn(() => ({
      getEntity: mockGetEntity,
      updateEntity: mockUpdateEntity
    }))
  },
  AzureNamedKeyCredential: jest.fn()
}));

const {
  rejectChapterApplication,
  claimChapterPublication,
  updateChapterPublication
} = require('../src/helpers/tableStorage');

describe('chapter publication storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateEntity.mockResolvedValue({});
  });

  test('atomically claims a pending application using its ETag', async () => {
    const application = {
      partitionKey: 'applications',
      rowKey: 'app-1',
      etag: 'etag-1',
      status: 'pending'
    };

    const result = await claimChapterPublication(application);

    expect(result.claimed).toBe(true);
    expect(result.application).toEqual(expect.objectContaining({
      status: 'approved',
      publicationStatus: 'dispatching',
      publicationAttempts: 1
    }));
    expect(mockUpdateEntity).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: 'app-1', publicationStatus: 'dispatching' }),
      'Merge',
      { etag: 'etag-1' }
    );
  });

  test('atomically rejects only a pending application', async () => {
    const application = {
      partitionKey: 'applications',
      rowKey: 'app-1',
      etag: 'etag-reject',
      status: 'pending'
    };

    const result = await rejectChapterApplication(application);

    expect(result.rejected).toBe(true);
    expect(mockUpdateEntity).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' }),
      'Merge',
      { etag: 'etag-reject' }
    );
  });

  test('does not reject an application already claimed for approval', async () => {
    const application = {
      rowKey: 'app-1',
      status: 'approved',
      publicationStatus: 'dispatching'
    };

    const result = await rejectChapterApplication(application);

    expect(result).toEqual({ rejected: false, application });
    expect(mockUpdateEntity).not.toHaveBeenCalled();
  });

  test('does not reclaim a queued publication', async () => {
    const application = {
      rowKey: 'app-1',
      status: 'approved',
      publicationStatus: 'queued',
      publicationUpdatedAt: new Date().toISOString()
    };

    const result = await claimChapterPublication(application);

    expect(result).toEqual({ claimed: false, application });
    expect(mockUpdateEntity).not.toHaveBeenCalled();
  });

  test('reclaims a stale queued publication for safe replay', async () => {
    const application = {
      rowKey: 'app-1',
      etag: 'etag-stale',
      status: 'approved',
      publicationStatus: 'queued',
      publicationUpdatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    };

    const result = await claimChapterPublication(application);

    expect(result.claimed).toBe(true);
    expect(result.application.publicationStatus).toBe('dispatching');
    expect(mockUpdateEntity).toHaveBeenCalledWith(
      expect.objectContaining({ publicationAttempts: 1 }),
      'Merge',
      { etag: 'etag-stale' }
    );
  });

  test('returns the winning state after an ETag conflict', async () => {
    const application = {
      rowKey: 'app-1',
      etag: 'etag-old',
      status: 'pending'
    };
    const conflict = new Error('condition not met');
    conflict.statusCode = 412;
    mockUpdateEntity.mockRejectedValueOnce(conflict);
    mockGetEntity.mockResolvedValueOnce({
      rowKey: 'app-1',
      status: 'approved',
      publicationStatus: 'queued'
    });

    const result = await claimChapterPublication(application);

    expect(result.claimed).toBe(false);
    expect(result.application.publicationStatus).toBe('queued');
    expect(mockGetEntity).toHaveBeenCalledWith('applications', 'app-1');
  });

  test('persists publication outcome fields with concurrency control', async () => {
    mockGetEntity.mockResolvedValueOnce({
      partitionKey: 'applications',
      rowKey: 'app-1',
      etag: 'etag-2',
      status: 'approved'
    });

    await updateChapterPublication('app-1', 'failed', {
      publicationError: 'GitHub rejected dispatch',
      ignored: 'not persisted'
    });

    expect(mockUpdateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        publicationStatus: 'failed',
        publicationError: 'GitHub rejected dispatch'
      }),
      'Merge',
      { etag: 'etag-2' }
    );
    expect(mockUpdateEntity.mock.calls[0][0]).not.toHaveProperty('ignored');
  });
});
