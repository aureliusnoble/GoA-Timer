// src/data/heroes.ts
import { Hero } from '../types';

// Sample hero data with expanded properties
export const heroes: Hero[] = [
  {
    id: 1,
    name: 'Arien',
    icon: '/heroes/arien.png',
    complexity: 1,
    roles: ['Tactician', 'Disabler'],
    expansion: 'Core',
    description: 'Arien is a master duelist who boasts the strongest attacks and disruption on the roster.'
  },
  {
    id: 2,
    name: 'Brogan',
    icon: '/heroes/brogan.png',
    complexity: 1,
    roles: ['Durable', 'Disabler'],
    expansion: 'Core',
    description: 'Brogan is the tank of Guards of Atlantis, nigh-unkillable and great at applying pressure in an area.'
  },
  {
    id: 3,
    name: 'Tigerclaw',
    icon: '/heroes/tigerclaw.png',
    complexity: 1,
    roles: ['Melee', 'Disabler'],
    expansion: 'Core',
    description: 'Tigerclaw is an evasive hero capable of dodging attacks and debilitating enemy heroes.'
  },
  {
    id: 4,
    name: 'Wasp',
    icon: '/heroes/wasp.png',
    complexity: 1,
    roles: ['Disabler', 'Tactician'],
    expansion: 'Core',
    description: 'Wasp is a crowd control specialist, with area control abilities.'
  },
  {
    id: 5,
    name: 'Sabina',
    icon: '/heroes/sabina.png',
    complexity: 1,
    roles: ['Tactician', 'Pusher'],
    expansion: 'Core',
    description: 'Sabina is a pusher who works best surrounded by friendly minions.'
  },
  {
    id: 6,
    name: 'Xargatha',
    icon: '/heroes/xargatha.png',
    complexity: 1,
    roles: ['Tactician', 'Pusher'],
    expansion: 'Core',
    description: 'Xargartha is a powerful brawler and zoner.'
  },
  {
    id: 7,
    name: 'Dodger',
    icon: '/heroes/dodger.png',
    complexity: 1,
    roles: ['Damager', 'Sniper'],
    expansion: 'Core',
    description: 'Dodger is damaging hero who becomes more powerful as her enemies become weaker.'
  },
 {
    id: 7,
    name: 'Rowenna',
    icon: '/heroes/rowenna.png',
    complexity: 2,
    roles: ['Melee', 'Durable'],
    expansion: 'Arcane',
    description: 'Rowenna is a front-line tank and battlefield support who excels at surviving in contested areas.'
  },
 {
    id: 8,
    name: 'Garrus',
    icon: '/heroes/garrus.png',
    complexity: 2,
    roles: ['Disabler', 'Durable'],
    expansion: 'Defiant',
    description: 'Garrus dominates the battlefield as a melee brawler who thrives on intimidation and control. '
  },
 {
    id: 9,
    name: 'Bain',
    icon: '/heroes/bain.png',
    complexity: 2,
    roles: ['Tactician', 'Sniper'],
    expansion: 'Defiant',
    description: 'Bain is a ranged initiator who specializes in marking targets, forcing discards, and setting up kills.'
  },
 {
    id: 10,
    name: 'Whisper',
    icon: '/heroes/whisper.png',
    complexity: 2,
    roles: ['Damager', 'Durable'],
    expansion: 'Devoted',
    description: 'Whisper is an adaptive support fighter whose power scales with battlefield clearing, gaining strength as minion spawns empty.'
  },
];

// Helper function to get all available expansions
export const getAllExpansions = (): string[] => {
  return ['Core', 'Devoted', 'Defiant', 'Wayward', 'Renowned', 'Arcane'];
};

// Helper function to filter heroes by expansions
export const filterHeroesByExpansions = (selectedExpansions: string[]): Hero[] => {
  return heroes.filter(hero => selectedExpansions.includes(hero.expansion));
};