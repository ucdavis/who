import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { detectSearchTypeFromText } from '@/routes/(authenticated)/index.tsx';
import { getPeopleDetailHref } from '@/shared/peopleLookupDetails.tsx';
import { server } from '@/test/mswUtils.ts';
import { renderRoute } from '@/test/routerUtils.tsx';

const searchOptions: Parameters<typeof detectSearchTypeFromText>[1] = [
  {
    label: 'Email',
    placeholder:
      'Paste emails or Outlook text; emails are extracted automatically',
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
      detectSearchTypeFromText(
        'Taylor Example <taylor@example.edu>',
        searchOptions
      )
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

  it('loads an externally generated Detail link containing an email address', async () => {
    let requestedId: string | undefined;

    server.use(
      http.get('/api/user/me', () =>
        HttpResponse.json({
          email: 'signed-in@example.com',
          id: 'user-1',
          name: 'Taylor',
          roles: [],
        })
      ),
      http.get('/api/peoplelookup/detail/:id', ({ params }) => {
        requestedId = String(params.id);
        return HttpResponse.json({
          allowSensitiveInfo: false,
          results: [
            {
              displayName: 'Jason Sylvestre',
              found: true,
              searchValue: requestedId,
            },
          ],
        });
      })
    );

    const { cleanup } = renderRoute({
      initialPath: '/Detail/jsylvestre@ucdavis.edu',
    });

    try {
      await screen.findByRole('heading', { level: 1, name: 'Jason Sylvestre' });
      expect(document.title).toBe('Person details for Jason Sylvestre | Who');
      expect(requestedId).toBe('jsylvestre@ucdavis.edu');
    } finally {
      cleanup();
    }
  });
});

describe('single user lookup not-found state', () => {
  it('uses the theme-aware muted error treatment', async () => {
    server.use(
      http.get('/api/user/me', () =>
        HttpResponse.json({
          email: 'signed-in@example.com',
          id: 'user-1',
          name: 'Taylor',
          roles: [],
        })
      ),
      http.get('/api/peoplelookup/detail/:id', () =>
        HttpResponse.json({
          allowSensitiveInfo: false,
          results: [
            {
              found: false,
              searchValue: 'missing-user',
            },
          ],
        })
      )
    );

    const { cleanup } = renderRoute({ initialPath: '/detail/missing-user' });

    try {
      const notFoundMessage = await screen.findByText('User not found.');
      const alert = notFoundMessage.closest('.alert');

      expect(notFoundMessage.closest('[role="status"]')).toBeInTheDocument();
      expect(alert).toHaveClass('alert-error', 'alert-soft');
      expect(alert).not.toHaveClass('alert-warning');
    } finally {
      cleanup();
    }
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
  it('tabs through the form in order and opens single-user details on Enter', async () => {
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
      expect(document.title).toBe('Bulk User Lookup | Who');
      await user.tab();
      expect(screen.getByRole('radio', { name: 'Email' })).toHaveFocus();
      await user.tab();
      expect(screen.getByLabelText('Values')).toHaveFocus();

      await user.keyboard('sample');
      await user.tab();
      expect(
        screen.getByRole('button', { name: 'Lookup Users' })
      ).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Clear' })).toHaveFocus();
      await user.tab();
      expect(singleUserField).toHaveFocus();
      await user.keyboard('kirkland');
      await user.tab();
      expect(
        screen.getByRole('button', { name: 'Open Details' })
      ).toHaveFocus();
      await user.tab({ shift: true });
      await user.keyboard('{Enter}');

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

      singleUserField.focus();

      fireEvent.keyDown(singleUserField, { key: 'k' });

      expect(screen.getByRole('radio', { name: 'Email' })).toBeChecked();

      fireEvent.keyDown(singleUserField, { ctrlKey: true, key: 'k' });

      const kerberosRadio = screen.getByRole('radio', { name: 'Kerberos ID' });
      expect(kerberosRadio).toBeChecked();
      expect(kerberosRadio).toHaveAttribute('aria-keyshortcuts', 'Control+K');
      expect(
        kerberosRadio.closest('label')?.querySelector('.underline')
      ).toHaveTextContent('K');
      expect(singleUserField).toHaveFocus();
    } finally {
      cleanup();
    }
  });

  it('shows the sensitive MOTHRA ID switch only with Rosetta and underlines its t shortcut', async () => {
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
      http.get('/api/app-info', () =>
        HttpResponse.json({ provider: 'Rosetta' })
      ),
      http.get('/api/peoplelookup/options', () =>
        HttpResponse.json({ allowSensitiveInfo: true })
      ),
      http.post('/api/peoplelookup/search', async ({ request }) => {
        submittedBody = await request.json();
        return HttpResponse.json({ allowSensitiveInfo: true, results: [] });
      })
    );

    const { cleanup } = renderRoute({ initialPath: '/' });

    try {
      const mothraRadio = await screen.findByRole('radio', {
        name: 'MOTHRA ID',
      });
      const singleUserField = screen.getByLabelText('Single user lookup');
      singleUserField.focus();

      expect(mothraRadio).toHaveAttribute('aria-keyshortcuts', 'Control+T');
      expect(
        mothraRadio.closest('label')?.querySelector('.underline')
      ).toHaveTextContent('T');

      fireEvent.keyDown(singleUserField, { ctrlKey: true, key: 't' });

      expect(mothraRadio).toBeChecked();
      expect(singleUserField).toHaveFocus();

      fireEvent.input(screen.getByLabelText('Values'), {
        target: { value: '12345' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Lookup Users' }));

      await waitFor(() =>
        expect(submittedBody).toEqual({
          searchText: '12345',
          searchType: 'mothraId',
        })
      );
    } finally {
      cleanup();
    }
  });

  it('hides the MOTHRA ID switch when IAM is used', async () => {
    server.use(
      http.get('/api/user/me', () =>
        HttpResponse.json({
          email: 'signed-in@example.com',
          id: 'user-1',
          name: 'Taylor',
          roles: [],
        })
      ),
      http.get('/api/app-info', () => HttpResponse.json({ provider: 'IAM' })),
      http.get('/api/peoplelookup/options', () =>
        HttpResponse.json({ allowSensitiveInfo: true })
      )
    );

    const { cleanup } = renderRoute({ initialPath: '/' });

    try {
      await screen.findByRole('radio', { name: 'Employee ID' });

      expect(
        screen.queryByRole('radio', { name: 'MOTHRA ID' })
      ).not.toBeInTheDocument();
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
      await waitFor(() =>
        expect(emptyState).toHaveTextContent('No results found.')
      );
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

describe('keyboard access to lookup results', () => {
  it('exposes row details and supports sorting, filtering, and clearing by keyboard', async () => {
    server.use(
      http.get('/api/user/me', () =>
        HttpResponse.json({ id: 'test', roles: [] })
      ),
      http.get('/api/peoplelookup/options', () =>
        HttpResponse.json({ allowSensitiveInfo: false })
      ),
      http.post('/api/peoplelookup/search', () =>
        HttpResponse.json({
          allowSensitiveInfo: false,
          results: [
            { displayName: 'Zoe Example', found: true, searchValue: 'zoe' },
            { displayName: 'Amy Example', found: true, searchValue: 'amy' },
          ],
        })
      )
    );
    const user = userEvent.setup();
    const { cleanup } = renderRoute();
    try {
      await user.type(await screen.findByLabelText('Values'), 'zoe,amy');
      await user.keyboard('{Control>}{Enter}{/Control}');
      const table = await screen.findByRole('table');
      const sort = within(table).getByRole('button', {
        name: 'Sort by Display Name',
      });
      sort.focus();
      await user.keyboard('{Enter}');
      expect(sort.closest('th')).toHaveAttribute('aria-sort', 'ascending');
      const rows = within(table).getAllByRole('row');
      expect(
        within(rows[1]).getByRole('button', { name: 'Details for Amy Example' })
      ).toBeEnabled();

      const filter = screen.getByRole('textbox', { name: 'Filter results' });
      await user.type(filter, 'no matches');
      expect(
        screen.getByText(/Showing 0-0 of 0/).closest('[role="status"]')
      ).toBeInTheDocument();
      await user.tab();
      expect(
        screen.getByRole('button', { name: 'Clear results filter' })
      ).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(filter).toHaveFocus();
      expect(within(table).getAllByRole('row')).toHaveLength(3);
    } finally {
      cleanup();
    }
  });
});
