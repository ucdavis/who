import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  detailFields,
  PeopleDetailsPanel,
  type PeopleSearchResult,
} from '@/shared/peopleLookupDetails.tsx';

const baseResult: PeopleSearchResult = {
  displayName: 'First Middle Last',
  found: true,
  fullLivedName: 'First M Last',
  isEmployee: false,
  isExternal: false,
  isFaculty: false,
  isHsEmployee: false,
  isStaff: false,
  isStudent: false,
  searchValue: 'person@example.com',
};

afterEach(() => cleanup());

describe('PeopleDetailsPanel', () => {
  it('places full lived name immediately after display name', () => {
    const displayNameIndex = detailFields.findIndex(
      (field) => field.key === 'displayName'
    );

    expect(detailFields[displayNameIndex + 1]).toEqual({
      group: 'identity',
      key: 'fullLivedName',
      label: 'Full Lived Name',
    });
  });

  it('shows display name when sensitive fields are hidden', () => {
    render(
      <PeopleDetailsPanel allowSensitiveInfo={false} result={baseResult} />
    );

    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('person@example.com')).toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByText('First Middle Last')).toBeInTheDocument();
    expect(screen.getByText('Full Lived Name')).toBeInTheDocument();
    expect(screen.getByText('First M Last')).toBeInTheDocument();
  });

  it('keeps display name separate from full lived name', () => {
    render(
      <PeopleDetailsPanel allowSensitiveInfo={true} result={baseResult} />
    );

    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('person@example.com')).toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByText('First Middle Last')).toBeInTheDocument();
    expect(screen.getByText('Full Lived Name')).toBeInTheDocument();
    expect(screen.getByText('First M Last')).toBeInTheDocument();
  });

  it('shows the Rosetta last-updated date and time with sensitive fields', () => {
    const lastUpdated = '2026-08-18T21:35:00Z';
    const expectedDateTime = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(lastUpdated));

    render(
      <PeopleDetailsPanel
        allowSensitiveInfo={true}
        result={{ ...baseResult, lastUpdated }}
      />
    );

    expect(screen.getByText('Sensitive Identifiers')).toBeInTheDocument();
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
    expect(screen.getByText(expectedDateTime)).toBeInTheDocument();
  });

  it('hides the Rosetta last-updated date and time with sensitive fields', () => {
    render(
      <PeopleDetailsPanel
        allowSensitiveInfo={false}
        result={{ ...baseResult, lastUpdated: '2026-08-18T21:35:00Z' }}
      />
    );

    expect(screen.queryByText('Last Updated')).not.toBeInTheDocument();
  });

  it('can hide the search field for the dedicated detail page', () => {
    render(
      <PeopleDetailsPanel
        allowSensitiveInfo={false}
        result={baseResult}
        showSearchField={false}
      />
    );

    expect(screen.queryByText('Search')).not.toBeInTheDocument();
    expect(screen.queryByText('person@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
  });
});
