import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { api, auth } = vi.hoisted(() => ({
  api: {
    getConversations: vi.fn(),
    getMessages: vi.fn(),
    acceptOffer: vi.fn(),
    counterOffer: vi.fn(),
    updateRentalStatus: vi.fn(),
    createRental: vi.fn(),
    sendMessage: vi.fn(),
    markConversationRead: vi.fn(),
    sendAttachment: vi.fn(),
    getPriceCheck: vi.fn(),
    translateMessages: vi.fn(),
  },
  auth: { user: null },
}));

const { uploads } = vi.hoisted(() => ({
  uploads: { uploadAttachment: vi.fn(), signedAttachmentUrl: vi.fn(), shrinkImage: vi.fn() },
}));
vi.mock('../lib/chatAttachments', async (importOriginal) => ({ ...(await importOriginal()), ...uploads }));

vi.mock('../lib/api', () => ({ api }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../context/LanguageContext', () => ({ useLanguage: () => ({ lang: auth.lang || 'en', setLang: () => {} }) }));
vi.mock('../lib/supabaseClient', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { channel: () => channel, removeChannel: () => {} } };
});

const { default: Messages } = await import('./Messages.jsx');

const OWNER = { id: 'owner-1' };
const RENTER = { id: 'renter-1' };

const conversation = {
  id: 'conv-1',
  owner_id: OWNER.id,
  renter_id: RENTER.id,
  listing: { id: 'listing-1', title: 'Rotavator 5ft', status: 'available', price_per_day: 600, deposit_required: true, deposit_amount: 2000 },
  owner: { id: OWNER.id, full_name: 'Olivia' },
  renter: { id: RENTER.id, full_name: 'Ravi' },
  last_message: null,
};

function offerMessage({ id = 'm1', offerId = 'o1', by = RENTER.id, price = 450, status = 'open', rentalStatus = 'pending', start = '2099-10-12', end = '2099-10-15' } = {}) {
  return {
    id,
    conversation_id: 'conv-1',
    sender_id: by,
    kind: 'offer',
    body: 'Offer: …',
    created_at: '2099-01-01T10:00:00Z',
    offer: {
      id: offerId,
      rental_id: 'rental-1',
      proposed_by: by,
      price_per_day: price,
      start_date: start,
      end_date: end,
      status,
      rental: { id: 'rental-1', status: rentalStatus, renter_id: RENTER.id, listed_price_per_day: 600 },
    },
  };
}

function renderAs(user, messages) {
  auth.user = user;
  api.getConversations.mockResolvedValue([conversation]);
  api.getMessages.mockResolvedValue(messages);
  return render(
    <MemoryRouter initialEntries={['/messages?c=conv-1']}>
      <Messages />
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.markConversationRead.mockResolvedValue({});
  api.getPriceCheck.mockResolvedValue({ estimate: null, similar: [], similar_stats: null });
  api.translateMessages.mockResolvedValue({ translations: {} });
  auth.lang = undefined;
  Object.values(uploads).forEach((fn) => fn.mockReset());
  uploads.shrinkImage.mockImplementation(async (f) => f);
  uploads.signedAttachmentUrl.mockResolvedValue('https://signed.example/file');
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
});

describe('Messages - offer cards', () => {
  it('shows the owner the offered price next to the listed price, with Accept / Counter / Decline', async () => {
    renderAs(OWNER, [offerMessage()]);

    expect(await screen.findByText('Ravi sent a request')).toBeInTheDocument();
    expect(screen.getByText('₹450')).toBeInTheDocument();
    expect(screen.getAllByText(/₹150\/day below listed/).length).toBeGreaterThan(0);
    expect(screen.getByText('₹1,800')).toBeInTheDocument();
    expect(screen.getByText('₹2,000 · at pickup')).toBeInTheDocument();
    expect(screen.getByText('Negotiating · ₹450/day')).toBeInTheDocument();
    for (const name of ['Accept', 'Counter', 'Decline']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    // Owners never start an offer themselves.
    expect(screen.queryByRole('button', { name: /offer/i })).not.toBeInTheDocument();
  });

  it('accepting calls the API for that rental and reloads the thread', async () => {
    api.acceptOffer.mockResolvedValue({});
    renderAs(OWNER, [offerMessage()]);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept' }));

    expect(api.acceptOffer).toHaveBeenCalledWith('rental-1');
    await waitFor(() => expect(api.getMessages).toHaveBeenCalledTimes(2));
  });

  it('the owner declining rejects the request', async () => {
    api.updateRentalStatus.mockResolvedValue({});
    renderAs(OWNER, [offerMessage()]);
    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));

    expect(api.updateRentalStatus).toHaveBeenCalledWith('rental-1', 'rejected');
  });

  it('countering opens a form prefilled with the offer and sends the new terms', async () => {
    api.counterOffer.mockResolvedValue({});
    renderAs(OWNER, [offerMessage()]);
    await userEvent.click(await screen.findByRole('button', { name: 'Counter' }));

    const price = screen.getByLabelText('Your price per day');
    expect(price).toHaveValue(450);
    fireEvent.change(price, { target: { value: '525' } });
    await userEvent.click(screen.getByRole('button', { name: 'Send counter-offer' }));

    expect(api.counterOffer).toHaveBeenCalledWith('rental-1', {
      start_date: '2099-10-12',
      end_date: '2099-10-15',
      price_per_day: 525,
    });
  });

  it('shows the renter their own offer as waiting, with Withdraw instead of Accept', async () => {
    api.updateRentalStatus.mockResolvedValue({});
    renderAs(RENTER, [offerMessage()]);

    expect(await screen.findByText('You sent a request')).toBeInTheDocument();
    expect(screen.getByText('Waiting for Olivia to respond…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    // An offer is already open, so no second one can be started.
    expect(screen.queryByRole('button', { name: /make an offer/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(api.updateRentalStatus).toHaveBeenCalledWith('rental-1', 'cancelled');
  });

  it("gives the renter Accept on the owner's counter-offer, and marks the earlier offer countered", async () => {
    renderAs(RENTER, [
      offerMessage({ status: 'countered' }),
      offerMessage({ id: 'm2', offerId: 'o2', by: OWNER.id, price: 525 }),
    ]);

    expect(await screen.findByText('Olivia countered')).toBeInTheDocument();
    expect(screen.getByText('Countered')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(1);
  });

  it('shows an agreed deal and the status line', async () => {
    renderAs(RENTER, [
      offerMessage({ status: 'accepted', rentalStatus: 'approved', price: 525 }),
      {
        id: 'm3',
        conversation_id: 'conv-1',
        sender_id: OWNER.id,
        kind: 'system',
        body: 'Deal agreed: ₹525/day …',
        created_at: '2099-01-01T11:00:00Z',
        offer: null,
      },
    ]);

    expect(await screen.findByText('Deal agreed · ₹525/day')).toBeInTheDocument();
    expect(screen.getByText('✓ Accepted')).toBeInTheDocument();
    expect(screen.getByText('Deal agreed: ₹525/day …')).toBeInTheDocument();
  });

  it('lets the renter make an offer from the chat when nothing is open', async () => {
    api.createRental.mockResolvedValue({});
    const { container } = renderAs(RENTER, []);
    await userEvent.click(await screen.findByRole('button', { name: /make an offer/i }));

    const [start, end] = container.querySelectorAll('input[type="date"]');
    fireEvent.change(start, { target: { value: '2099-11-01' } });
    fireEvent.change(end, { target: { value: '2099-11-02' } });
    fireEvent.change(screen.getByLabelText('Your price per day'), { target: { value: '500' } });
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));

    expect(api.createRental).toHaveBeenCalledWith({
      listing_id: 'listing-1',
      start_date: '2099-11-01',
      end_date: '2099-11-02',
      price_per_day: 500,
    });
  });

  it('shows an API error in the thread when accepting fails', async () => {
    api.acceptOffer.mockRejectedValue(new Error('This item is already booked for part of those dates'));
    renderAs(OWNER, [offerMessage()]);
    await userEvent.click(await screen.findByRole('button', { name: 'Accept' }));

    expect(await screen.findByText('This item is already booked for part of those dates')).toBeInTheDocument();
  });

  it('keeps plain text messages as chat bubbles', async () => {
    renderAs(OWNER, [
      { id: 't1', conversation_id: 'conv-1', sender_id: RENTER.id, kind: 'text', body: 'Can you do 500?', created_at: '2099-01-01T09:00:00Z', offer: null },
    ]);
    const bubble = await screen.findByText('Can you do 500?');
    expect(within(bubble.parentElement).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Messages - WhatsApp-style chat list and receipts', () => {
  const now = new Date();
  const minutesAgo = (n) => new Date(now.getTime() - n * 60000).toISOString();

  function listWith(overrides) {
    api.getConversations.mockResolvedValue([{ ...conversation, ...overrides }]);
  }

  function renderChat(user, { conv = {}, messages = [], url = '/messages?c=conv-1' } = {}) {
    auth.user = user;
    listWith(conv);
    api.getMessages.mockResolvedValue(messages);
    return render(
      <MemoryRouter initialEntries={[url]}>
        <Messages />
      </MemoryRouter>
    );
  }

  it('marks the open chat as read', async () => {
    renderChat(OWNER, { messages: [offerMessage()] });
    await waitFor(() => expect(api.markConversationRead).toHaveBeenCalledWith('conv-1'));
  });

  it('shows the unread count and last message in the chat list', async () => {
    renderChat(OWNER, {
      url: '/messages',
      conv: { unread_count: 2, last_message: { body: 'Is it still available?', sender_id: RENTER.id, kind: 'text', created_at: minutesAgo(5) } },
    });
    expect(await screen.findByLabelText('2 unread')).toBeInTheDocument();
    expect(screen.getByText('Is it still available?')).toBeInTheDocument();
    expect(screen.getByText('Pick a chat to start messaging.')).toBeInTheDocument();
    expect(api.markConversationRead).not.toHaveBeenCalled();
  });

  it('shows ✓✓ once the other person has read my message, ✓ before', async () => {
    const text = (id, at) => ({ id, conversation_id: 'conv-1', sender_id: RENTER.id, kind: 'text', body: `msg ${id}`, created_at: at, offer: null });
    renderChat(RENTER, {
      conv: { other_last_read_at: minutesAgo(10) },
      messages: [text('a', minutesAgo(20)), text('b', minutesAgo(1))],
    });
    await screen.findByText('msg b');
    expect(within(screen.getByText('msg a').parentElement).getByLabelText('Read')).toBeInTheDocument();
    expect(within(screen.getByText('msg b').parentElement).getByLabelText('Sent')).toBeInTheDocument();
  });

  it('separates messages by day', async () => {
    renderChat(RENTER, {
      messages: [
        { id: 'y', conversation_id: 'conv-1', sender_id: OWNER.id, kind: 'text', body: 'yesterday msg', created_at: new Date(now.getTime() - 86400000).toISOString(), offer: null },
        { id: 't', conversation_id: 'conv-1', sender_id: OWNER.id, kind: 'text', body: 'today msg', created_at: now.toISOString(), offer: null },
      ],
    });
    await screen.findByText('today msg');
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('filters chats by search', async () => {
    auth.user = OWNER;
    api.getConversations.mockResolvedValue([
      conversation,
      { ...conversation, id: 'conv-2', listing: { ...conversation.listing, id: 'listing-2', title: 'Pressure washer' }, renter: { id: 'renter-2', full_name: 'Meera' } },
    ]);
    api.getMessages.mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={['/messages']}>
        <Messages />
      </MemoryRouter>
    );
    await screen.findByText('Meera');
    await userEvent.type(screen.getByPlaceholderText('Search by name, item or message'), 'washer');
    expect(screen.getByText('Meera')).toBeInTheDocument();
    expect(screen.queryByText('Ravi')).not.toBeInTheDocument();
  });

  it('the back arrow closes the chat', async () => {
    renderChat(RENTER, { messages: [] });
    await userEvent.click(await screen.findByRole('button', { name: 'Back to chats' }));
    expect(await screen.findByText('Pick a chat to start messaging.')).toBeInTheDocument();
  });
});

describe('Messages - the + menu (photos, documents, location)', () => {
  function renderChat(messages = []) {
    auth.user = RENTER;
    api.getConversations.mockResolvedValue([conversation]);
    api.getMessages.mockResolvedValue(messages);
    return render(
      <MemoryRouter initialEntries={['/messages?c=conv-1']}>
        <Messages />
      </MemoryRouter>
    );
  }

  it('opens a menu with Photos, Camera, Document and Location beside Send', async () => {
    renderChat();
    await userEvent.click(await screen.findByRole('button', { name: 'Attach' }));
    for (const name of ['Photos', 'Camera', 'Document', 'Location']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('uploads a chosen photo into the chat folder and sends it', async () => {
    const attachment = { path: 'conv-1/x-photo.jpg', name: 'photo.jpg', size: 5, mime_type: 'image/jpeg' };
    uploads.uploadAttachment.mockResolvedValue(attachment);
    api.sendAttachment.mockResolvedValue({
      id: 'img1', conversation_id: 'conv-1', sender_id: RENTER.id, kind: 'image', body: '📷 Photo', attachment, created_at: new Date().toISOString(), offer: null,
    });
    renderChat();
    await screen.findByRole('button', { name: 'Attach' });

    const photo = new File(['hello'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('attach-photos'), { target: { files: [photo] } });

    await waitFor(() => expect(api.sendAttachment).toHaveBeenCalledWith('conv-1', 'image', attachment));
    expect(uploads.uploadAttachment).toHaveBeenCalledWith('conv-1', photo);
    expect(await screen.findByAltText('photo.jpg')).toHaveAttribute('src', 'https://signed.example/file');
  });

  it('sends a PDF as a document', async () => {
    const attachment = { path: 'conv-1/x-lease.pdf', name: 'lease.pdf', size: 5, mime_type: 'application/pdf' };
    uploads.uploadAttachment.mockResolvedValue(attachment);
    api.sendAttachment.mockResolvedValue({ id: 'f1', conversation_id: 'conv-1', sender_id: RENTER.id, kind: 'file', body: '📄 lease.pdf', attachment, created_at: new Date().toISOString(), offer: null });
    renderChat();
    await screen.findByRole('button', { name: 'Attach' });

    fireEvent.change(screen.getByTestId('attach-document'), { target: { files: [new File(['%PDF'], 'lease.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(api.sendAttachment).toHaveBeenCalledWith('conv-1', 'file', attachment));
    expect(await screen.findByText('lease.pdf')).toBeInTheDocument();
  });

  it("refuses a file type that isn't allowed, without uploading it", async () => {
    renderChat();
    await screen.findByRole('button', { name: 'Attach' });
    fireEvent.change(screen.getByTestId('attach-document'), { target: { files: [new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' })] } });

    expect(await screen.findByText(/setup\.exe isn't a supported document/)).toBeInTheDocument();
    expect(uploads.uploadAttachment).not.toHaveBeenCalled();
  });

  it('shows a failed upload with the reason', async () => {
    uploads.uploadAttachment.mockRejectedValue(new Error('The object exceeded the maximum allowed size'));
    renderChat();
    await screen.findByRole('button', { name: 'Attach' });
    fireEvent.change(screen.getByTestId('attach-photos'), { target: { files: [new File(['x'], 'big.jpg', { type: 'image/jpeg' })] } });

    expect(await screen.findByText(/Failed: The object exceeded/)).toBeInTheDocument();
    expect(api.sendAttachment).not.toHaveBeenCalled();
  });

  it('renders a received document with a download link and a location with a Maps link', async () => {
    renderChat([
      { id: 'f', conversation_id: 'conv-1', sender_id: OWNER.id, kind: 'file', body: '📄 Agreement.pdf', attachment: { path: 'conv-1/a.pdf', name: 'Agreement.pdf', size: 245760, mime_type: 'application/pdf' }, created_at: new Date().toISOString(), offer: null },
      { id: 'l', conversation_id: 'conv-1', sender_id: OWNER.id, kind: 'location', body: '📍 Main gate', attachment: { lat: 28.6129, lng: 77.2295, label: 'Main gate' }, created_at: new Date().toISOString(), offer: null },
    ]);

    expect(await screen.findByText('Agreement.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF · 240 KB')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Download Agreement.pdf' })).toHaveAttribute('href', 'https://signed.example/file');
    expect(screen.getByText('Main gate')).toBeInTheDocument();
    expect(screen.getByTitle('Open in Google Maps')).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=28.6129,77.2295');
  });
});

describe('Messages - chat text is kept away from the page translator', () => {
  it('marks what people typed, and their names, so the page translator leaves them alone', async () => {
    renderAs(OWNER, [
      { id: 't1', conversation_id: 'conv-1', sender_id: RENTER.id, kind: 'text', body: 'kal milega kya?', created_at: '2099-01-01T09:00:00Z', offer: null },
    ]);
    expect(await screen.findByText('kal milega kya?')).toHaveAttribute('translate', 'no');
    for (const name of screen.getAllByText('Ravi')) expect(name).toHaveAttribute('translate', 'no');
  });
});

describe('Messages - safety warnings', () => {
  it("warns under the other person's risky message, but not under mine", async () => {
    renderAs(OWNER, [
      { id: 't1', conversation_id: 'conv-1', sender_id: RENTER.id, kind: 'text', body: 'Send me the OTP please', created_at: '2099-01-01T09:00:00Z', offer: null },
      { id: 't2', conversation_id: 'conv-1', sender_id: OWNER.id, kind: 'text', body: 'Never ask for an OTP', created_at: '2099-01-01T09:05:00Z', offer: null },
    ]);
    await screen.findByText('Send me the OTP please');
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByRole('note')).toHaveTextContent('Never share these');
  });
});

describe('Messages - sending', () => {
  it("sends the sender's language along, so the server can translate before delivering", async () => {
    auth.lang = 'hi';
    api.sendMessage.mockResolvedValue({ id: 'new', conversation_id: 'conv-1', sender_id: RENTER.id, kind: 'text', body: 'नमस्ते', created_at: '2099-01-01T10:00:00Z' });
    renderAs(RENTER, []);
    await userEvent.type(await screen.findByLabelText('Message'), 'नमस्ते');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith('conv-1', 'नमस्ते', 'hi'));
  });
});

describe("Messages - translation into the reader's language", () => {
  const theirs = { id: 't1', conversation_id: 'conv-1', sender_id: RENTER.id, kind: 'text', body: 'kal milega kya?', created_at: '2099-01-01T09:00:00Z', offer: null };
  const mine = { id: 't2', conversation_id: 'conv-1', sender_id: OWNER.id, kind: 'text', body: 'Haan', created_at: '2099-01-01T09:05:00Z', offer: null };

  it("shows the other person's message in my language, with the original a tap away", async () => {
    api.translateMessages.mockResolvedValue({ translations: { t1: { text: 'Will I get it tomorrow?', source: 'hi', translated: true } } });
    renderAs(OWNER, [theirs, mine]);

    expect(await screen.findByText('Will I get it tomorrow?')).toBeInTheDocument();
    expect(api.translateMessages).toHaveBeenCalledWith('en', ['t1']); // never my own message
    expect(screen.getByText('Haan')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Translated from Hindi · Show original' }));
    expect(screen.getByText('kal milega kya?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show translation' }));
    expect(screen.getByText('Will I get it tomorrow?')).toBeInTheDocument();
  });

  it('asks for the language the reader picked', async () => {
    auth.lang = 'ta';
    renderAs(OWNER, [theirs]);
    await waitFor(() => expect(api.translateMessages).toHaveBeenCalledWith('ta', ['t1']));
  });

  it('shows a message as written, with no toggle, when it was already in my language', async () => {
    api.translateMessages.mockResolvedValue({ translations: { t1: { text: 'kal milega kya?', source: 'en', translated: false } } });
    renderAs(OWNER, [theirs]);
    const bubble = await screen.findByText('kal milega kya?');
    await waitFor(() => expect(api.translateMessages).toHaveBeenCalled());
    expect(within(bubble.parentElement).queryByRole('button')).not.toBeInTheDocument();
  });
});
