// src/data/heroes.ts
import { Hero } from '../types';

// Sample hero data with expanded properties
export const heroes: Hero[] = [
  {
    id: 1,
    name: 'Brogan',
    icon: '/heroes/brogan.png',
    complexity: 2,
    roles: ['Tank', 'Defender'],
    expansion: 'Core',
    description: 'A tank hero with high defense'
  },
  {
    id: 2,
    name: 'Sabina',
    icon: '/heroes/sabina.png',
    complexity: 3,
    roles: ['Assassin', 'Mobility'],
    expansion: 'Core',
    description: 'A high-mobility attacker'
  },
  {
    id: 3,
    name: 'Arien',
    icon: '/heroes/arien.png',
    complexity: 2,
    roles: ['Ranged', 'Damage'],
    expansion: 'Core',
    description: 'A ranged damage dealer'
  },
  {
    id: 4,
    name: 'Misa',
    icon: '/heroes/misa.png',
    complexity: 3,
    roles: ['Support', 'Healer'],
    expansion: 'Devoted',
    description: 'A support hero with healing abilities'
  },
  {
    id: 5,
    name: 'Dodger',
    icon: '/heroes/dodger.png',
    complexity: 4,
    roles: ['Mobility', 'Evasion'],
    expansion: 'Defiant',
    description: 'An elusive hero with high initiative'
  },
  {
    id: 6,
    name: 'Gideon',
    icon: '/heroes/gideon.png',
    complexity: 3,
    roles: ['Commander', 'Control'],
    expansion: 'Core',
    description: 'A commander with area control abilities'
  },
  {
    id: 7,
    name: 'Korrus',
    icon: '/heroes/korrus.png',
    complexity: 2,
    roles: ['Berserker', 'Attacker'],
    expansion: 'Wayward',
    description: 'A berserker with powerful attacks'
  },
  {
    id: 8,
    name: 'Nyra',
    icon: '/heroes/nyra.png',
    complexity: 4,
    roles: ['Spellcaster', 'Area Effect'],
    expansion: 'Arcane',
    description: 'A spellcaster with area of effect skills'
  },
  {
    id: 9,
    name: 'Trent',
    icon: '/heroes/trent.png',
    complexity: 1,
    roles: ['Defender', 'Disruptor'],
    expansion: 'Renowned',
    description: 'A defender with disruptive abilities'
  },
  {
    id: 10,
    name: 'Valeria',
    icon: '/heroes/valeria.png',
    complexity: 2,
    roles: ['Fighter', 'Versatile'],
    expansion: 'Core',
    description: 'A versatile fighter with strong single-target skills'
  },
  // Additional heroes would be added here to reach all 40
];

// Helper function to get all available expansions
export const getAllExpansions = (): string[] => {
  return ['Core', 'Devoted', 'Defiant', 'Wayward', 'Renowned', 'Arcane'];
};

// Helper function to filter heroes by expansions
export const filterHeroesByExpansions = (selectedExpansions: string[]): Hero[] => {
  return heroes.filter(hero => selectedExpansions.includes(hero.expansion));
};