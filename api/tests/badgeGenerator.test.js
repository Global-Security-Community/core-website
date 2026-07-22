const sharp = require('sharp');
const { generateBadge, generateSharedEventBadgePng } = require('../src/helpers/badgeGenerator');

describe('badgeGenerator', () => {
  const baseOpts = {
    recipientName: 'Jane Smith',
    eventTitle: 'Global Security Bootcamp Perth 2026',
    eventDate: '2026-05-15',
    eventLocation: 'Perth Convention Centre, WA',
    badgeType: 'Attendee'
  };

  test('generates valid SVG for Attendee badge', () => {
    const svg = generateBadge(baseOpts);
    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Jane Smith');
    expect(svg).toContain('ATTENDEE');
    expect(svg).toContain('Global Security Bootcamp Perth 2026');
    expect(svg).toContain('2026-05-15');
    expect(svg).toContain('Perth Convention Centre, WA');
    expect(svg).toContain('GLOBAL SECURITY COMMUNITY');
  });

  test('generates Speaker badge with correct colour', () => {
    const svg = generateBadge({ ...baseOpts, badgeType: 'Speaker' });
    expect(svg).toContain('SPEAKER');
    expect(svg).toContain('#ffa500'); // orange for speakers
  });

  test('generates Organiser badge with correct colour', () => {
    const svg = generateBadge({ ...baseOpts, badgeType: 'Organiser' });
    expect(svg).toContain('ORGANISER');
    expect(svg).toContain('#e74c3c'); // red for organisers
  });

  test('escapes HTML in recipient name', () => {
    const svg = generateBadge({ ...baseOpts, recipientName: '<script>alert("xss")</script>' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  test('truncates long names', () => {
    const longName = 'A'.repeat(50);
    const svg = generateBadge({ ...baseOpts, recipientName: longName });
    expect(svg).toContain('…'); // truncated
  });

  test('handles empty/null values gracefully', () => {
    const svg = generateBadge({
      recipientName: '',
      eventTitle: '',
      eventDate: '',
      eventLocation: '',
      badgeType: 'Attendee'
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('ATTENDEE');
  });

  test('falls back to Attendee colours for unknown badge type', () => {
    const svg = generateBadge({ ...baseOpts, badgeType: 'Unknown' });
    expect(svg).toContain('#20b2aa'); // teal (attendee default)
  });

  test('generates distinct shared PNG variants from the same event details', async () => {
    const details = {
      eventTitle: baseOpts.eventTitle,
      eventDate: baseOpts.eventDate,
      eventLocation: baseOpts.eventLocation
    };
    const [attendee, speaker, organiser] = await Promise.all([
      generateSharedEventBadgePng({ ...details, badgeType: 'Attendee' }, null),
      generateSharedEventBadgePng({ ...details, badgeType: 'Speaker' }, null),
      generateSharedEventBadgePng({ ...details, badgeType: 'Organiser' }, null)
    ]);

    expect(attendee.equals(speaker)).toBe(false);
    expect(speaker.equals(organiser)).toBe(false);
    await expect(sharp(attendee).metadata()).resolves.toMatchObject({ width: 1024, height: 1024, format: 'png' });
    await expect(sharp(speaker).metadata()).resolves.toMatchObject({ width: 1024, height: 1024, format: 'png' });
    await expect(sharp(organiser).metadata()).resolves.toMatchObject({ width: 1024, height: 1024, format: 'png' });
  });
});
