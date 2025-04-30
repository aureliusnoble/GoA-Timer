// src/data/heroes.ts
import { Hero } from '../types';

// Sample hero data - in a real implementation, you would have all 40 heroes
export const heroes: Hero[] = [
  {
    id: 1,
    name: 'Brogan',
    icon: '/heroes/brogan.png',
    description: 'A tank hero with high defense'
  },
  {
    id: 2,
    name: 'Sabina',
    icon: '/heroes/sabina.png',
    description: 'A high-mobility attacker'
  },
  {
    id: 3,
    name: 'Arien',
    icon: '/heroes/arien.png',
    description: 'A ranged damage dealer'
  },
  {
    id: 4,
    name: 'Misa',
    icon: '/heroes/misa.png',
    description: 'A support hero with healing abilities'
  },
  {
    id: 5,
    name: 'Dodger',
    icon: '/heroes/dodger.png',
    description: 'An elusive hero with high initiative'
  },
  {
    id: 6,
    name: 'Gideon',
    icon: '/heroes/gideon.png',
    description: 'A commander with area control abilities'
  },
  {
    id: 7,
    name: 'Korrus',
    icon: '/heroes/korrus.png',
    description: 'A berserker with powerful attacks'
  },
  {
    id: 8,
    name: 'Nyra',
    icon: '/heroes/nyra.png',
    description: 'A spellcaster with area of effect skills'
  },
  {
    id: 9,
    name: 'Trent',
    icon: '/heroes/trent.png',
    description: 'A defender with disruptive abilities'
  },
  {
    id: 10,
    name: 'Valeria',
    icon: '/heroes/valeria.png',
    description: 'A versatile fighter with strong single-target skills'
  },
  // Additional heroes would be added here to reach all 40
];