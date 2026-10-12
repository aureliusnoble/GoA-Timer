import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PlayerNameInput from '../../components/PlayerNameInput';
import { Team } from '../../types';

vi.mock('../../context/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn() }),
}));

const SUGGESTIONS = ['Alice', 'Alfred', 'Bob'];

function renderInput(initialName = '') {
  const onNameChange = vi.fn();
  render(
    <PlayerNameInput
      player={{ id: 1, team: Team.Titans, hero: null, name: initialName }}
      onNameChange={onNameChange}
      suggestedNames={SUGGESTIONS}
    />
  );
  const input = screen.getByRole('combobox') as HTMLInputElement;
  return { input, onNameChange };
}

function focusAndType(input: HTMLInputElement, text: string) {
  act(() => {
    input.focus();
  });
  fireEvent.change(input, { target: { value: text } });
}

/** Focus leaves the input (as after Tab or a click elsewhere), then any pending timers run. */
function blurAndSettle(input: HTMLInputElement) {
  act(() => {
    input.blur();
  });
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PlayerNameInput keyboard selection', () => {
  it('ArrowDown + Enter accepts the suggestion and it does not revert afterwards', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, 'Al');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(input.value).toBe('Alice');
    expect(onNameChange).toHaveBeenLastCalledWith('Alice');
    expect(onNameChange).not.toHaveBeenCalledWith('Al');
  });

  it('Tab accepts the suggestion highlighted with the arrow keys and lets focus move on', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, 'Al');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const notPrevented = fireEvent.keyDown(input, { key: 'Tab' });
    expect(notPrevented).toBe(true);
    blurAndSettle(input);
    expect(input.value).toBe('Alfred');
    expect(onNameChange).toHaveBeenLastCalledWith('Alfred');
  });

  it('Tab accepts the suggestion highlighted by mouse hover', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, 'Al');
    fireEvent.mouseEnter(screen.getByText('Alfred'));
    const notPrevented = fireEvent.keyDown(input, { key: 'Tab' });
    expect(notPrevented).toBe(true);
    blurAndSettle(input);
    expect(input.value).toBe('Alfred');
    expect(onNameChange).toHaveBeenLastCalledWith('Alfred');
  });

  it('Tab with nothing highlighted keeps the typed text', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, 'Al');
    const notPrevented = fireEvent.keyDown(input, { key: 'Tab' });
    expect(notPrevented).toBe(true);
    blurAndSettle(input);
    expect(input.value).toBe('Al');
    expect(onNameChange).toHaveBeenLastCalledWith('Al');
    expect(onNameChange).not.toHaveBeenCalledWith('Alice');
  });

  it('typing after hovering a suggestion clears the highlight, so Tab keeps the typed text', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, 'Al');
    fireEvent.mouseEnter(screen.getByText('Alice'));
    fireEvent.change(input, { target: { value: 'Alf' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    blurAndSettle(input);
    expect(input.value).toBe('Alf');
    expect(onNameChange).toHaveBeenLastCalledWith('Alf');
  });

  it('Enter with nothing highlighted commits the typed text and closes the list', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, 'Al');
    fireEvent.keyDown(input, { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(input.value).toBe('Al');
    expect(onNameChange).toHaveBeenCalledTimes(1);
    expect(onNameChange).toHaveBeenLastCalledWith('Al');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Escape closes the list and keeps the typed text', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, 'Al');
    fireEvent.keyDown(input, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('Al');
    expect(onNameChange).toHaveBeenLastCalledWith('Al');
  });
});

describe('PlayerNameInput commits', () => {
  it('commits the trimmed name synchronously on blur and never again later', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, '  Bo  ');
    act(() => {
      input.blur();
    });
    expect(onNameChange).toHaveBeenCalledTimes(1);
    expect(onNameChange).toHaveBeenLastCalledWith('Bo');
    expect(input.value).toBe('Bo');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onNameChange).toHaveBeenCalledTimes(1);
  });

  it('does not report anything when focus passes through without a change', () => {
    const { input, onNameChange } = renderInput('Bob');
    act(() => {
      input.focus();
    });
    blurAndSettle(input);
    expect(onNameChange).not.toHaveBeenCalled();
  });

  it('clicking a suggestion commits it immediately', () => {
    const { input, onNameChange } = renderInput();
    focusAndType(input, 'Al');
    fireEvent.mouseDown(screen.getByText('Alfred'));
    expect(onNameChange).toHaveBeenLastCalledWith('Alfred');
    blurAndSettle(input);
    expect(input.value).toBe('Alfred');
    expect(onNameChange).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerNameInput in a parent that updates from a captured array', () => {
  // Mirrors the parents' old pattern: handlers close over the `names` array of their render.
  function Harness({ initial }: { initial: string[] }) {
    const [names, setNames] = useState<string[]>(initial);
    return (
      <div>
        {names.map((name, index) => (
          <PlayerNameInput
            key={index}
            player={{ id: index, team: Team.Titans, hero: null, name }}
            onNameChange={(newName) => setNames(names.map((n, i) => (i === index ? newName : n)))}
            onRemove={() => setNames(names.filter((_, i) => i !== index))}
            suggestedNames={SUGGESTIONS}
          />
        ))}
        <button onClick={() => setNames([...names, ''])}>Add</button>
      </div>
    );
  }

  const nameInputs = () => screen.getAllByRole('combobox') as HTMLInputElement[];

  it('typing a name then clicking Add keeps both the name and the new row', () => {
    render(<Harness initial={['']} />);
    focusAndType(nameInputs()[0], 'Zed');
    act(() => {
      nameInputs()[0].blur(); // mousedown on "Add" moves focus first
    });
    fireEvent.click(screen.getByText('Add'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(nameInputs().map((input) => input.value)).toEqual(['Zed', '']);
  });

  it("typing a name then clicking that row's Remove does not bring the row back", () => {
    render(<Harness initial={['Ann', '']} />);
    focusAndType(nameInputs()[1], 'Zed');
    act(() => {
      nameInputs()[1].blur();
    });
    fireEvent.click(screen.getAllByLabelText('Remove player')[1]);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(nameInputs().map((input) => input.value)).toEqual(['Ann']);
  });
});
