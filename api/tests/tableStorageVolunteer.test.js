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
  countRegistrationsForEvents,
  isVolunteerOrOrganiserByRegistration,
  getScannerEventIdsByEmail,
  getApprovedApplicationByEmail,
  getApprovedApplicationsByEmail
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

  test('counts registrations only for included public events', async () => {
    mockClient.listEntities.mockReturnValueOnce(entities([
      { partitionKey: 'published-1' },
      { partitionKey: 'draft-1' },
      { partitionKey: 'published-2' },
      { partitionKey: 'published-1' }
    ]));

    await expect(countRegistrationsForEvents(['published-1', 'published-2'])).resolves.toBe(3);
    expect(mockClient.listEntities).toHaveBeenCalledWith({
      queryOptions: { select: ['PartitionKey'] }
    });
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

  test('combines current, legacy, and volunteer-table scanner assignments', async () => {
    mockClient.listEntities
      .mockReturnValueOnce(entities([
        { partitionKey: 'event-1', role: 'volunteer' },
        { partitionKey: 'ignored-event', role: 'attendee' }
      ]))
      .mockReturnValueOnce(entities([
        { partitionKey: 'event-2', email: 'Volunteer@Example.com', role: 'organiser' }
      ]))
      .mockReturnValueOnce(entities([
        { partitionKey: 'event-3' },
        { partitionKey: 'event-1' }
      ]));

    const eventIds = await getScannerEventIdsByEmail('volunteer@example.com');

    expect(eventIds).toEqual(['event-1', 'event-2', 'event-3']);
  });

  test('matches a chapter lead added through leadsJson', async () => {
    mockClient.listEntities.mockReturnValueOnce(entities([{
      partitionKey: 'applications',
      rowKey: 'melbourne',
      city: 'Melbourne',
      status: 'approved',
      email: 'original@example.com',
      leadsJson: JSON.stringify([
        { name: 'Original Lead', email: 'original@example.com' },
        { name: 'New Lead', email: 'New.Lead@Example.com' }
      ])
    }]));

    const application = await getApprovedApplicationByEmail('new.lead@example.com');

    expect(application).toEqual(expect.objectContaining({ city: 'Melbourne' }));
  });

  test('includes all chapters where the user appears in leadsJson', async () => {
    mockClient.listEntities.mockReturnValueOnce(entities([
      {
        city: 'Melbourne',
        status: 'approved',
        leadsJson: JSON.stringify([{ email: 'lead@example.com' }])
      },
      {
        city: 'Sydney',
        status: 'approved',
        leadsJson: JSON.stringify([{ email: 'other@example.com' }])
      },
      {
        city: 'Perth',
        status: 'approved',
        secondLeadEmail: 'LEAD@example.com'
      }
    ]));

    const applications = await getApprovedApplicationsByEmail('lead@example.com');

    expect(applications.map(application => application.city)).toEqual(['Melbourne', 'Perth']);
  });

  test('does not retain legacy access after an edited lead is removed', async () => {
    mockClient.listEntities.mockReturnValueOnce(entities([{
      city: 'Melbourne',
      status: 'approved',
      email: 'removed@example.com',
      secondLeadEmail: 'also-removed@example.com',
      leadsJson: JSON.stringify([{ email: 'current@example.com' }])
    }]));

    const application = await getApprovedApplicationByEmail('removed@example.com');

    expect(application).toBeNull();
  });
});
