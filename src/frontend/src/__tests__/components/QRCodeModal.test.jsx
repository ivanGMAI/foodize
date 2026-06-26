import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QRCodeModal from '../../components/ui/QRCodeModal';
import QRCode from 'qrcode';

vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn().mockResolvedValue(undefined),
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test'),
  },
}));

describe('QRCodeModal', () => {
  const restaurant = {
    id: 'restaurant-uuid',
    display_id: 'food-court-7',
    name: 'Food Court',
  };

  beforeEach(() => {
    vi.stubEnv('VITE_WEB_URL', 'https://foodize.test/');
    vi.stubEnv('VITE_BOT_USERNAME', '@FoodizeBot');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses display_id for the site QR link', async () => {
    render(<QRCodeModal restaurant={restaurant} onClose={vi.fn()} />);

    const link = 'https://foodize.test/restaurants/food-court-7';
    expect(screen.getByText(link)).toBeInTheDocument();
    await waitFor(() => {
      expect(QRCode.toCanvas).toHaveBeenCalledWith(
        expect.any(HTMLCanvasElement),
        link,
        expect.objectContaining({ width: 240 })
      );
    });
  });

  it('switches Telegram QR to bot start payload with the same display_id', async () => {
    render(<QRCodeModal restaurant={restaurant} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Telegram' }));

    const link = 'https://t.me/FoodizeBot?start=restaurant_food-court-7';
    expect(screen.getByText(link)).toBeInTheDocument();
    await waitFor(() => {
      expect(QRCode.toCanvas).toHaveBeenLastCalledWith(
        expect.any(HTMLCanvasElement),
        link,
        expect.objectContaining({ width: 240 })
      );
    });
  });

  it('falls back to restaurant id when display_id is absent', () => {
    render(
      <QRCodeModal
        restaurant={{ ...restaurant, display_id: null }}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText('https://foodize.test/restaurants/restaurant-uuid')
    ).toBeInTheDocument();
  });
});
