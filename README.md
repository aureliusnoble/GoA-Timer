# Guards of Atlantis II Timer

A custom timer application for the board game "Guards of Atlantis II", designed to help manage gameplay timers and track game state.

## Features

- **Hero Selection**: Choose from 40 unique heroes for each player
- **Team Management**: Assign heroes to Titans (blue) or Atlanteans (red) teams
- **Strategy Timer**: Set a countdown for the team discussion phase
- **Move Timer**: Individual timers for each player's turn
- **Game State Tracking**:
  - Wave counter
  - Team life counters
  - Turn and round tracking
  - Tiebreaker coin flipping functionality

## Game Rules Overview

Guards of Atlantis II is a competitive team-based board game that combines elements of strategy, positioning, and resource management. Players control unique heroes with their own abilities and playstyles, fighting alongside minions on a strategic map.

The core game revolves around three main structures:

1. **Actions**: Each round consists of 4 turns, and on each turn, you'll play a card and perform one action from that card.

2. **Hand**: Your hand of cards represents your potential for the round. Each card has different attributes including initiative (speed), movement, defense, and either a skill or attack action.

3. **Position**: The game is played on a map with different zones like battle zones, throne zones, and jungles.

The primary win conditions involve defeating enemy heroes and controlling minions. Players must strategically manage their hero's position, actions, and cards to outmaneuver opponents and achieve victory.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/guards-of-atlantis-timer.git
cd guards-of-atlantis-timer
```

2. Install dependencies
```bash
npm install
# or
yarn
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Deployment to GitHub Pages

1. Update the `vite.config.ts` file with your repository name:
```ts
export default defineConfig({
  plugins: [react()],
  base: '/guards-of-atlantis-timer/', // Replace with your repo name
});
```

2. Run the deployment script:
```bash
npm run deploy
# or
yarn deploy
```

3. Your app will be available at `https://yourusername.github.io/guards-of-atlantis-timer/`

## Customization

### Modifying Hero Data

To add or modify hero data, edit the `src/data/heroes.ts` file. Each hero follows this format:

```typescript
{
  id: number,
  name: string,
  icon: string, // Path to hero icon
  description?: string
}
```

### Styling

The application uses Tailwind CSS for styling. Custom styles can be added in:
- `src/index.css` - For global styles
- `src/App.css` - For component-specific styles
- `tailwind.config.js` - For Tailwind theme customization

# Copyright


# To-Do
- Copyright notices



-Tooltip. Once all players selected a hero make it go away
- tiebreaker: Team (should click to flip. )
- Deploy