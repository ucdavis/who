import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PeopleDetailsPanel,
  type PeopleSearchResult,
} from '@/shared/peopleLookupDetails.tsx';

const baseResult: PeopleSearchResult = {
  found: true,
  fullName: 'First Middle Last',
  isEmployee: false,
  isExternal: false,
  isFaculty: false,
  isHsEmployee: false,
  isStaff: false,
  isStudent: false,
  officialFullName: 'First M Last',
  searchValue: 'person@example.com',
};

afterEach(() => cleanup());

describe('PeopleDetailsPanel', () => {
  it('shows full name when sensitive fields are hidden', () => {
    render(
      <PeopleDetailsPanel allowSensitiveInfo={false} result={baseResult} />
    );

    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('person@example.com')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('First Middle Last')).toBeInTheDocument();
    expect(screen.queryByText('Official Full Name')).not.toBeInTheDocument();
    expect(screen.queryByText('First M Last')).not.toBeInTheDocument();
  });

  it('keeps full name separate from sensitive official full name', () => {
    render(
      <PeopleDetailsPanel allowSensitiveInfo={true} result={baseResult} />
    );

    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('person@example.com')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('First Middle Last')).toBeInTheDocument();
    expect(screen.getByText('Official Full Name')).toBeInTheDocument();
    expect(screen.getByText('First M Last')).toBeInTheDocument();
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
    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });
});
