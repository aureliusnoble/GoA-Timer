// src/data/heroes.ts
import { Hero } from '../types';

// Sample hero data with expanded properties
export const heroes: Hero[] = [
  {
    id: 0,
    name: 'Arien',
    icon: '/heroes/arien.png',
    complexity: 1,
    roles: ['Tactician', 'Disabler'],
    expansion: 'Core',
    description: 'Arien is a master duelist who boasts the strongest attacks and disruption on the roster.'
  },
  {
    id: 1,
    name: 'Brogan',
    icon: '/heroes/brogan.png',
    complexity: 1,
    roles: ['Durable', 'Disabler'],
    expansion: 'Core',
    description: 'Brogan is the tank of Guards of Atlantis, nigh-unkillable and great at applying pressure in an area.'
  },
  {
    id: 2,
    name: 'Tigerclaw',
    icon: '/heroes/tigerclaw.png',
    complexity: 1,
    roles: ['Melee', 'Disabler'],
    expansion: 'Core',
    description: 'Tigerclaw is an evasive hero capable of dodging attacks and debilitating enemy heroes.'
  },
  {
    id: 3,
    name: 'Wasp',
    icon: '/heroes/wasp.png',
    complexity: 1,
    roles: ['Disabler', 'Tactician'],
    expansion: 'Core',
    description: 'Wasp is a crowd control specialist, with area control abilities.'
  },
  {
    id: 4,
    name: 'Sabina',
    icon: '/heroes/sabina.png',
    complexity: 1,
    roles: ['Tactician', 'Pusher'],
    expansion: 'Core',
    description: 'Sabina is a pusher who works best surrounded by friendly minions.'
  },
  {
    id: 5,
    name: 'Xargatha',
    icon: '/heroes/xargatha.png',
    complexity: 1,
    roles: ['Tactician', 'Pusher'],
    expansion: 'Core',
    description: 'Xargartha is a powerful brawler and zoner.'
  },
  {
    id: 6,
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
 {
    id: 11,
    name: 'Misa',
    icon: '/heroes/Misa.png',
    complexity: 2,
    roles: ['Tactician', 'Durabke'],
    expansion: 'Devoted',
    description: ''
  },
 {
    id: 12,
    name: 'Ursafar',
    icon: '/heroes/Ursafar.png',
    complexity: 2,
    roles: ['Durable', 'Pusher'],
    expansion: 'Devoted',
    description: ''
  },
 {
    id: 13,
    name: 'Silverarrow',
    icon: '/heroes/silverarrow.png',
    complexity: 2,
    roles: ['Sniper', 'Damager'],
    expansion: 'Devoted',
    description: ''
  },
 {
    id: 14,
    name: 'Min',
    icon: '/heroes/min.png',
    complexity: 2,
    roles: ['Tokens', 'Disabler'],
    expansion: 'Renowned',
    description: ''
  },
 {
    id: 15,
    name: 'Mrak',
    icon: '/heroes/mrak.png',
    complexity: 3,
    roles: ['Melee', 'Tokens'],
    expansion: 'Arcane',
    description: ''
  },
 {
    id: 16,
    name: 'Cutter',
    icon: '/heroes/cutter.png',
    complexity: 3,
    roles: ['Tactician', 'Disabler'],
    expansion: 'Defiant',
    description: ''
  },
 {
    id: 17,
    name: 'Trinkets',
    icon: '/heroes/trinkers.png',
    complexity: 3,
    roles: ['Sniper', 'Damager'],
    expansion: 'Defiant',
    description: ''
  },
 {
    id: 18,
    name: 'Tali',
    icon: '/heroes/tali.png',
    complexity: 3,
    roles: ['Damager', 'Pusher'],
    expansion: 'Devoted',
    description: ''
  },
 {
    id: 19,
    name: 'Swift',
    icon: '/heroes/swift.png',
    complexity: 3,
    roles: ['Sniper', 'Farming'],
    expansion: 'Renowned',
    description: ''
  },
 {
    id: 20,
    name: 'Wuk',
    icon: '/heroes/wuk.png',
    complexity: 3,
    roles: ['Tokens', 'Pusher'],
    expansion: 'Renowned',
    description: ''
  }
];

// Helper function to get all available expansions
export const getAllExpansions = (): string[] => {
  return ['Core', 'Devoted', 'Defiant', 'Wayward', 'Renowned', 'Arcane'];
};

// Helper function to filter heroes by expansions
export const filterHeroesByExpansions = (selectedExpansions: string[]): Hero[] => {
  return heroes.filter(hero => selectedExpansions.includes(hero.expansion));
};