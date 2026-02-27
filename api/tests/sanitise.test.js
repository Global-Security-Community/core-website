const { stripHtml, sanitiseFields } = require('../src/helpers/sanitise');

describe('sanitise helper', () => {
  describe('stripHtml', () => {
    test('strips script tags', () => {
      expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    test('strips HTML tags but preserves text', () => {
      expect(stripHtml('Hello <b>world</b>')).toBe('Hello world');
    });

    test('strips nested tags', () => {
      expect(stripHtml('<div><p>hello</p></div>')).toBe('hello');
    });

    test('returns empty string for null/undefined', () => {
      expect(stripHtml(null)).toBe('');
      expect(stripHtml(undefined)).toBe('');
      expect(stripHtml('')).toBe('');
    });

    test('returns non-string inputs as empty', () => {
      expect(stripHtml(123)).toBe('');
      expect(stripHtml({})).toBe('');
    });

    test('preserves plain text', () => {
      expect(stripHtml('Just plain text')).toBe('Just plain text');
    });

    test('strips img tags with src', () => {
      expect(stripHtml('<img src="x" onerror="alert(1)">')).toBe('');
    });

    test('handles multiple tags', () => {
      expect(stripHtml('<h1>Title</h1><p>Body <a href="#">link</a></p>')).toBe('TitleBody link');
    });
  });

  describe('sanitiseFields', () => {
    test('sanitises specified fields only', () => {
      const input = { name: '<b>Bob</b>', email: '<script>x</script>@test.com', city: 'Perth' };
      const result = sanitiseFields(input, ['name', 'city']);
      expect(result.name).toBe('Bob');
      expect(result.email).toBe('<script>x</script>@test.com'); // not in fields list
      expect(result.city).toBe('Perth');
    });

    test('preserves original object', () => {
      const input = { name: '<b>Bob</b>' };
      sanitiseFields(input, ['name']);
      expect(input.name).toBe('<b>Bob</b>'); // original not mutated
    });

    test('handles missing fields gracefully', () => {
      const input = { name: 'Alice' };
      const result = sanitiseFields(input, ['name', 'nonexistent']);
      expect(result.name).toBe('Alice');
      expect(result.nonexistent).toBeUndefined();
    });
  });
});
