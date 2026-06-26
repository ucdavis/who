import { describe, expect, it } from 'vitest';
import { detectSearchTypeFromText } from '@/routes/(authenticated)/index.tsx';

const searchOptions: Parameters<typeof detectSearchTypeFromText>[1] = [
  {
    label: 'Email',
    placeholder: 'Paste emails or Outlook text; emails are extracted automatically',
    value: 'email',
  },
  {
    label: 'Kerberos ID',
    placeholder: 'Paste Kerberos IDs separated by spaces, commas, or lines',
    value: 'kerb',
  },
  {
    label: 'IAM ID',
    placeholder: 'Paste IAM IDs',
    value: 'iamId',
  },
  {
    label: 'Last Name',
    placeholder: 'Paste last names',
    value: 'lastName',
  },
  {
    label: 'PPSA Department Code',
    placeholder: 'Paste PPSA department codes',
    value: 'ppsaDeptCode',
  },
];

describe('people lookup paste detection', () => {
  it('does not auto-detect PPSA department code-shaped pasted text', () => {
    expect(
      detectSearchTypeFromText('abc-123\ndef-456', searchOptions)
    ).toBeNull();
  });

  it('does not auto-detect PPSA department code from pasted labels', () => {
    expect(
      detectSearchTypeFromText(
        'PPSA Department Code\nabc-123\ndef-456',
        searchOptions
      )
    ).toBeNull();
  });

  it('still auto-detects other pasted search types', () => {
    expect(
      detectSearchTypeFromText('Taylor Example <taylor@example.edu>', searchOptions)
    ).toBe('email');
    expect(detectSearchTypeFromText('IAM\n1234567890', searchOptions)).toBe(
      'iamId'
    );
  });
});