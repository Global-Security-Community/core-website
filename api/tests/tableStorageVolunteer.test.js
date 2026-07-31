process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';

const mockClient = {
  createEntity: jest.fn().mockResolvedValue({}),
  listEntities: jest.fn()
};

jest.mock('@azure/data-tables', () => ({
  TableClient: {
    fromConnectionString: jest.fn(() => mockClient)
  },
  AzureNamedKeyCredential: jest.fn()
}));

const {
  storeRegistration,
  isVolunteerOrOrganiserByRegistration
} = require('../src/helpers/tableStorage');

function entities(values) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* values;
    }
  };
}

describe('volunteer registration email matching', () => {
  beforeEach(() => jest.clearAllMocks());

  test('stores a normalised email alongside the original address', async () => {
    await storeRegistration({
      eventId: 'event-1',
      id: 'registration-1',
      userId: 'user-1',
      fullName: 'Volunteer',
      email: 'Volunteer@Example.COM',
      ticketCode: 'TEST1234',
      role: 'volunteer'
    });

    expect(mockClient.createEntity).toHaveBeenCalledWith(expect.objectContaining({
      email: 'Volunteer@Example.COM',
      normalisedEmail: 'volunteer@example.com'
    }));
  });

  test('matches mixed-case email on a legacy event registration', async () => {
    mockClient.listEntities
      .mockReturnValueOnce(entities([]))
      .mockReturnValueOnce(entities([{
        partitionKey: 'event-1',
        email: 'Volunteer@Example.COM',
        role: 'volunteer'
      }]));

    const registration = await isVolunteerOrOrganiserByRegistration(
      'volunteer@example.com',
      'event-1'
    );

    expect(registration).toEqual(expect.objectContaining({ role: 'volunteer' }));
    expect(mockClient.listEntities).toHaveBeenNthCalledWith(2, {
      queryOptions: {
        filter: "PartitionKey eq 'event-1'",
        select: ['email', 'role']
      }
    });
  });

  test('limits the global legacy fallback to volunteer records and email fields', async () => {
    mockClient.listEntities
      .mockReturnValueOnce(entities([]))
      .mockReturnValueOnce(entities([]));

    await isVolunteerOrOrganiserByRegistration('volunteer@example.com');

    expect(mockClient.listEntities).toHaveBeenNthCalledWith(2, {
      queryOptions: {
        filter: "(role eq 'volunteer' or role eq 'organiser')",
        select: ['email', 'role']
      }
    });
  });
});
