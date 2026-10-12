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
// Stand-in that commits the name 200 ms LATE, with the onNameChange captured at blur time.
vi.mock('../../../components/PlayerNameInput', () => ({
  default: (props: {
    player: { name: string };
    onNameChange: (name: string) => void;
    onRemove?: () => void;
    isDuplicate?: boolean;
  }) => (
    <div>
      <input
        aria-label="Player name"
        defaultValue={props.player.name}
        onBlur={(e) => {
          const typed = e.currentTarget.value;
          const commit = props.onNameChange;
          setTimeout(() => commit(typed), 200);
        }}
      />
      <button onClick={props.onRemove}>Remove row</button>
      {props.isDuplicate && <span>Duplicate name</span>}
    </div>
  ),
}));

const nameInputs = () => screen.getAllByLabelText('Player name') as HTMLInputElement[];

function typeAndLeave(input: HTMLInputElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
  fireEvent.blur(input);
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

describe('RecordMatch survives late name commits', () => {
  it('a name committed after Add does not drop the added row', async () => {
    await renderRecordMatch();
    fireEvent.click(screen.getByText('Add Titan Player'));
    typeAndLeave(nameInputs()[0], 'Zed');
    fireEvent.click(screen.getByText('Add Atlantean Player'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(nameInputs()).toHaveLength(2);
  });

  it('a name committed after Remove does not bring the removed row back', async () => {
    await renderRecordMatch();
    fireEvent.click(screen.getByText('Add Titan Player'));
    fireEvent.click(screen.getByText('Add Atlantean Player'));
    typeAndLeave(nameInputs()[1], 'Zed');
    fireEvent.click(screen.getAllByText('Remove row')[0]);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(nameInputs()).toHaveLength(1);
  });

  it('duplicate-name warnings follow name changes and removals', async () => {
    await renderRecordMatch();
    fireEvent.click(screen.getByText('Add Titan Player'));
    fireEvent.click(screen.getByText('Add Atlantean Player'));
    typeAndLeave(nameInputs()[0], 'Zed');
    typeAndLeave(nameInputs()[1], 'Zed');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getAllByText('Duplicate name')).toHaveLength(2);
    fireEvent.click(screen.getAllByText('Remove row')[1]);
    expect(screen.queryAllByText('Duplicate name')).toHaveLength(0);
  });
});
