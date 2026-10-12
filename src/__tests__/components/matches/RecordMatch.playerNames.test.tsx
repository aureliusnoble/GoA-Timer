import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RecordMatch from '../../../components/matches/RecordMatch';

vi.mock('../../../context/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn() }),
}));
vi.mock('../../../services/DatabaseService', () => ({
  default: {
    getAllPlayers: vi.fn().mockResolvedValue([]),
    recordMatch: vi.fn().mockResolvedValue(undefined),
  },
}));

const nameInputs = () => screen.getAllByRole('combobox') as HTMLInputElement[];

/** Type into a name field, then move focus away (what mousedown on another button does). */
function typeAndLeave(input: HTMLInputElement, text: string) {
  act(() => {
    input.focus();
  });
  fireEvent.change(input, { target: { value: text } });
  act(() => {
    input.blur();
  });
}

async function renderRecordMatch() {
  render(<RecordMatch onBack={() => {}} />);
  await act(async () => {}); // let the mocked getAllPlayers() promise settle
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RecordMatch player names', () => {
  it('clicking Add right after typing a name keeps the name and the new row', async () => {
    await renderRecordMatch();
    fireEvent.click(screen.getByText('Add Titan Player'));
    typeAndLeave(nameInputs()[0], 'Zed');
    fireEvent.click(screen.getByText('Add Atlantean Player'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(nameInputs().map((input) => input.value)).toEqual(['Zed', '']);
  });

  it('removing a different row right after typing keeps the name on the right player', async () => {
    await renderRecordMatch();
    fireEvent.click(screen.getByText('Add Titan Player'));
    fireEvent.click(screen.getByText('Add Atlantean Player'));
    fireEvent.click(screen.getByText('Add Titan Player'));
    typeAndLeave(nameInputs()[1], 'Zed');
    fireEvent.click(screen.getAllByLabelText('Remove player')[0]);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(nameInputs().map((input) => input.value)).toEqual(['Zed', '']);
  });
});
