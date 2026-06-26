import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  detectSearchTypeFromText,
  getPeopleDetailHref,
} from '@/routes/(authenticated)/index.tsx';
import { server } from '@/test/mswUtils.ts';
import { renderRoute } from '@/test/routerUtils.tsx';

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

describe('people lookup detail links', () => {
  it('keeps email addresses readable while encoding unsafe path characters', () => {
    expect(getPeopleDetailHref('person@example.com')).toBe(
      '/detail/person@example.com'
    );
    expect(getPeopleDetailHref('folder/person@example.com')).toBe(
      '/detail/folder%2Fperson@example.com'
    );
  });
});

describe('people lookup clear button', () => {
  it('is only enabled when there is lookup state to clear', async () => {
    server.use(
      http.get('/api/user/me', () =>
        HttpResponse.json({
          email: 'signed-in@example.com',
          id: 'user-1',
          name: 'Taylor',
          roles: [],
        })
      ),
      http.get('/api/peoplelookup/options', () =>
        HttpResponse.json({ allowSensitiveInfo: false })
      )
    );

    const { cleanup } = renderRoute({ initialPath: '/' });

    try {
      await screen.findByRole('heading', { name: 'Bulk User Lookup' });

      const clearButton = screen.getByRole('button', { name: 'Clear' });
      const valuesField = screen.getByLabelText('Values');

      expect(clearButton).toBeDisabled();

      fireEvent.input(valuesField, {
        target: { value: 'person@example.com' },
      });

      expect(clearButton).toBeEnabled();

      fireEvent.click(clearButton);

      expect(valuesField).toHaveValue('');
      expect(clearButton).toBeDisabled();
    } finally {
      cleanup();
    }
  });
});
