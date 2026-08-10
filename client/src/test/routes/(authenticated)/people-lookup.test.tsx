import { fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
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
    shortcut: 'e',
    value: 'email',
  },
  {
    label: 'Kerberos ID',
    placeholder: 'Paste Kerberos IDs separated by spaces, commas, or lines',
    shortcut: 'k',
    value: 'kerb',
  },
  {
    label: 'IAM ID',
    placeholder: 'Paste IAM IDs',
    shortcut: 'i',
    value: 'iamId',
  },
  {
    label: 'Last Name',
    placeholder: 'Paste last names',
    shortcut: 'l',
    value: 'lastName',
  },
  {
    label: 'PPSA Department Code',
    placeholder: 'Paste PPSA department codes',
    shortcut: 'd',
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

describe('people lookup keyboard interactions', () => {
  it('focuses the single-user field and opens details on Enter', async () => {
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
      ),
      http.get('/api/peoplelookup/detail/:id', () =>
        HttpResponse.json({ allowSensitiveInfo: false, results: [] })
      )
    );

    const user = userEvent.setup();
    const { cleanup, router } = renderRoute({ initialPath: '/' });

    try {
      await screen.findByRole('heading', { name: 'Bulk User Lookup' });

      const singleUserField = screen.getByRole('textbox', {
        name: 'Single user lookup',
      });
      expect(singleUserField).toHaveFocus();

      await user.type(singleUserField, 'kirkland{Enter}');

      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/detail/kirkland')
      );
    } finally {
      cleanup();
    }
  });

  it('uses Ctrl+letter from an input without changing focus', async () => {
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
      const singleUserField = screen.getByLabelText('Single user lookup');

      expect(singleUserField).toHaveFocus();

      fireEvent.keyDown(singleUserField, { key: 'k' });

      expect(screen.getByRole('tab', { name: 'Email' })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      fireEvent.keyDown(singleUserField, { ctrlKey: true, key: 'k' });

      const kerberosTab = screen.getByRole('tab', { name: 'Kerberos ID' });
      expect(kerberosTab).toHaveAttribute('aria-selected', 'true');
      expect(kerberosTab).toHaveAttribute('aria-keyshortcuts', 'Control+K');
      expect(kerberosTab.querySelector('.underline')).toHaveTextContent('K');
      expect(singleUserField).toHaveFocus();
    } finally {
      cleanup();
    }
  });

  it.each([
    ['Ctrl+Enter', { ctrlKey: true }],
    ['Command+Enter', { metaKey: true }],
  ])('submits the bulk lookup with %s', async (_label, modifier) => {
    let submittedBody: unknown;

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
      ),
      http.post('/api/peoplelookup/search', async ({ request }) => {
        submittedBody = await request.json();
        return HttpResponse.json({
          allowSensitiveInfo: false,
          message: 'No results found.',
          results: [],
        });
      })
    );

    const { cleanup } = renderRoute({ initialPath: '/' });

    try {
      await screen.findByRole('heading', { name: 'Bulk User Lookup' });
      const valuesField = screen.getByLabelText('Values');

      fireEvent.input(valuesField, { target: { value: 'person@example.com' } });
      fireEvent.keyDown(valuesField, {
        ...modifier,
        key: 'Enter',
      });

      await waitFor(() =>
        expect(submittedBody).toEqual({
          searchText: 'person@example.com',
          searchType: 'email',
        })
      );
    } finally {
      cleanup();
    }
  });
});

describe('people lookup empty state', () => {
  it('shows the message prominently without a results table', async () => {
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
      ),
      http.post('/api/peoplelookup/search', () =>
        HttpResponse.json({
          allowSensitiveInfo: false,
          message: 'No results found.',
          results: [],
        })
      )
    );

    const { cleanup } = renderRoute({ initialPath: '/' });

    try {
      await screen.findByRole('heading', { name: 'Bulk User Lookup' });
      fireEvent.input(screen.getByLabelText('Values'), {
        target: { value: 'missing@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Lookup Users' }));

      const emptyState = await screen.findByRole('status');
      expect(emptyState).toHaveTextContent('No results found.');
      expect(emptyState).not.toHaveClass('alert-info');
      expect(
        screen.queryByRole('heading', { name: 'Results' })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    } finally {
      cleanup();
    }
  });
});
