# Guards of Atlantis II Timer

A custom timer application for the board game "Guards of Atlantis II", designed to help manage drafting, gameplay timers and track game state.

## Features

- **Hero Selection**: Choose different heroes for each player and receive information about the heroes. 
- **Drafting**: Choose a drafting method.
- **Strategy Timer**: Set a countdown for the team discussion phase
- **Action Timer**: Individual timers for each player's turn
- **Game State Tracking**:
  - Wave counter
  - Team life counters
  - Turn and round tracking
  - Tiebreaker coin flipping functionality

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/aureliusnoble/guards-of-atlantis-timer.git
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
  base: '/GoA-Timer/',
});
```

2. Run the deployment script:
```bash
npm run deploy
# or
yarn deploy
```

3. Your app will be available at `https://{github-username}.github.io/GoA-Timer/`

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

# Disclaimer
This app has not been officially approved by Wolff Designa (the designers of Guards of Atlantis). All game content, e.g. heroes, mechanics, images, etc. is the sole property of Wolff Designa.

# Future




Fix bug
- Over Time (as we increase min games should crop games before that value from hero and player stats)

New Draft Type
- Novel
-- Each player can choose from 3 options at least 1 1-2 star and at least 1 3-4 star they havent played with

- Pass
- Select Num Players + 4 heroes at random
- Each team chooses from these and pass them round.

Win Streaks (Best and current)

Card Database
- Opening Guides
- Build Guides
- Voting System
Add a Builds page where users can suggest builds? Users can rate these
Add an openings section where users can suggest openings. Users can rate these.
Add all the card data.
Record Build during game: items and upgrades.

