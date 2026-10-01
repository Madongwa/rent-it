import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SavedSearches from './SavedSearches';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { getSavedSearches: vi.fn(), deleteSavedSearch: vi.fn() },
}));

describe('SavedSearches', () => {
  it('lists saved searches with a link back to the Marketplace, and deletes', async () => {
    api.getSavedSearches.mockResolvedValue([{ id: 's1', label: 'tractor near Mandya', url_query: 'q=tractor&near=Mandya' }]);
    api.deleteSavedSearch.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <SavedSearches />
      </MemoryRouter>
    );
    const link = await screen.findByRole('link', { name: /tractor near Mandya/ }, { timeout: 5000 });
    expect(link).toHaveAttribute('href', '/marketplace?q=tractor&near=Mandya');
    await userEvent.click(screen.getByRole('button', { name: /Delete/ }));
    // Generous wait - this re-render can be slow when the whole suite runs.
    expect(await screen.findByText('No saved searches yet.', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(api.deleteSavedSearch).toHaveBeenCalledWith('s1');
  });
});
