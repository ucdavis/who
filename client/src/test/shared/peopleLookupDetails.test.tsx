import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('links Reports To details in a new tab before the copy button', () => {
    render(
      <PeopleDetailsPanel
        allowSensitiveInfo={true}
        result={{ ...baseResult, reportsToIamId: '1000123456' }}
      />
    );

    const detailsLink = screen.getByRole('link', {
      name: 'Open Reports To details',
    });
    const copyButton = screen.getByRole('button', {
      name: 'Copy Reports To',
    });

    expect(detailsLink).toHaveAttribute('href', '/detail/1000123456');
    expect(detailsLink).toHaveAttribute('target', '_blank');
    expect(detailsLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      detailsLink.compareDocumentPosition(copyButton) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('restores keyboard focus and announces a fallback copy inside a dialog', async () => {
    const user = userEvent.setup();
    render(
      <dialog aria-label="Person details" open>
        <PeopleDetailsPanel allowSensitiveInfo={false} result={baseResult} />
      </dialog>
    );
    const dialog = screen.getByRole('dialog');
    const copyButton = screen.getByRole('button', {
      name: 'Copy Display Name',
    });
    const execCommand = vi.fn(() => {
      const field = dialog.querySelector('textarea');
      return (
        field === document.activeElement &&
        field?.value === baseResult.displayName
      );
    });
    vi.stubGlobal('isSecureContext', false);
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    try {
      copyButton.focus();
      await user.keyboard('{Enter}');

      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(await screen.findByText('Display Name copied.')).toHaveAttribute(
        'role',
        'status'
      );
      expect(copyButton).toHaveFocus();
      expect(copyButton).toHaveAccessibleName('Copy Display Name');
      expect(dialog.querySelector('textarea')).toBeNull();
    } finally {
      if (original) {
        Object.defineProperty(document, 'execCommand', original);
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
      vi.unstubAllGlobals();
    }
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
