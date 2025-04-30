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
    icon: '/heroes/misa.png',
    complexity: 2,
    roles: ['Tactician', 'Durabke'],
    expansion: 'Devoted',
    description: 'Misa is an elite mobility assassin and disruptor who controls engagements through superior positioning and unpredictable movement.'
  },
 {
    id: 12,
    name: 'Ursafar',
    icon: '/heroes/ursafar.png',
    complexity: 2,
    roles: ['Durable', 'Pusher'],
    expansion: 'Devoted',
    description: 'Ursafar is a momentum-based melee brawler who transforms from adequate to overwhelming once his "enraged" state activates.'
  },
 {
    id: 13,
    name: 'Silverarrow',
    icon: '/heroes/silverarrow.png',
    complexity: 2,
    roles: ['Sniper', 'Damager'],
    expansion: 'Devoted',
    description: 'Silverarrow is a long-range zone controller and initiator who dominates through superior positioning and distance management.'
  },
 {
    id: 14,
    name: 'Min',
    icon: '/heroes/min.png',
    complexity: 2,
    roles: ['Tokens', 'Disabler'],
    expansion: 'Renowned',
    description: "Min strikes with lightning speed as one of the game's fastest initiators, wielding ancient dragon-inspired martial arts"
  },
 {
    id: 15,
    name: 'Mrak',
    icon: '/heroes/mrak.png',
    complexity: 3,
    roles: ['Melee', 'Tokens'],
    expansion: 'Arcane',
    description: 'Mrak is a heavyweight disrupter, commanding powers of rock and stone. Slow and immobile, he is at his best when the action comes to him.'
  },
 {
    id: 16,
    name: 'Cutter',
    icon: '/heroes/cutter.png',
    complexity: 3,
    roles: ['Tactician', 'Disabler'],
    expansion: 'Defiant',
    description: 'Cutter dances across the battlefield, striking precisely when opportunity presents itself. Her grappling hook allows last-second positioning, while her fork-creating attacks force impossible decisions upon enemies.'
  },
 {
    id: 17,
    name: 'Trinkets',
    icon: '/heroes/trinkets.png',
    complexity: 3,
    roles: ['Sniper', 'Damager'],
    expansion: 'Defiant',
    description: 'Trinkets is a light-weight (literally, probably), fast, highly-mobile, ranged killer who presents an enormous danger zone in the Venn Diagram between himself and his Turret.'
  },
 {
    id: 18,
    name: 'Tali',
    icon: '/heroes/tali.png',
    complexity: 3,
    roles: ['Damager', 'Pusher'],
    expansion: 'Devoted',
    description: "Tali commands the spirit world as a premier support hero, manipulating the battlefield with ice tokens and healing totems while wielding unparalleled discard potential."
  },
 {
    id: 19,
    name: 'Swift',
    icon: '/heroes/swift.png',
    complexity: 3,
    roles: ['Sniper', 'Farming'],
    expansion: 'Renowned',
    description: 'Swift dominates from the shadows with the extremely long attack range, forcing enemies to respect vast areas of the battlefield or face deadly consequences.'
  },
 {
    id: 20,
    name: 'Wuk',
    icon: '/heroes/wuk.png',
    complexity: 3,
    roles: ['Tokens', 'Pusher'],
    expansion: 'Renowned',
    description: "With Wuk at the table, nobody needs to be reminded about the thousand pound gorilla in the room. Everyone's watching to see where Wuk puts down his trees and defines his turf."
  },
 {
    id: 21,
    name: 'Hanu',
    icon: '/heroes/hanu.png',
    complexity: 3,
    roles: ['Tactician', 'Sniper'],
    expansion: 'Renowned',
    description: 'Hanu the Trickster is the pinnacle support hero. His repertoire of cards allow for copious amounts of shenanigans, bamboozling, knavery, and outright mischief.'
  },
 {
    id: 22,
    name: 'Brynn',
    icon: '/heroes/brynn.png',
    complexity: 3,
    roles: ['Tactician', 'Damager'],
    expansion: 'Wayward',
    description: 'Brynn is a tactical battlefield manipulator who creates and exploits positioning traps, gaining powerful bonuses when enemies are surrounded by three or more obstacles.'
  },
 {
    id: 23,
    name: 'Mortimer',
    icon: '/heroes/mortimer.png',
    complexity: 3,
    roles: ['Melee', 'Tokens'],
    expansion: 'Wayward',
    description: 'Mortimer is a battlefield controller who compensates for his limited mobility by commanding persistent zombie tokens that remain on the board between rounds.'
  },
 {
    id: 24,
    name: 'Widget and Pyro',
    icon: '/heroes/widget.png',
    complexity: 3,
    roles: ['Melee', 'Tokens'],
    expansion: 'Wayward',
    description: 'Widget is a kobold tactician who operates as a dual-unit fighter alongside her emotional support dragon, Pyro, allowing her to control two points on the battlefield simultaneously.'
  },
 {
    id: 25,
    name: 'Snorri',
    icon: '/heroes/snorri.png',
    complexity: 4,
    roles: ['Sniper', 'Farming'],
    expansion: 'Arcane',
    description: 'Snorri is a traditional dwarf who wields the power of four distinct runes to transform how each of his cards functions.'
  },
 {
    id: 26,
    name: 'Razzle',
    icon: '/heroes/razzle.png',
    complexity: 4,
    roles: ['Tactician', 'Melee'],
    expansion: 'Arcane',
    description: 'Razzle is a fractured fey who multiplies across the battlefield, controlling up to four separate copies of herself simultaneously.'
  },
 {
    id: 27,
    name: 'Gydion',
    icon: '/heroes/gydion.png',
    complexity: 4,
    roles: ['Sniper', 'Tactician'],
    expansion: 'Arcane',
    description: 'Gydion is an absent-minded archwizard who manages two separate hands—his action cards and a unique spellbook deck. He prepares spells that are consumed upon casting, requiring careful resource management to maximize his arcane potential.'
  },
 {
    id: 28,
    name: 'Nebkher',
    icon: '/heroes/nebkher.png',
    complexity: 4,
    roles: ['Disabler', 'Tokens'],
    expansion: 'Defiant',
    description: 'NebKher is a space-bending undead mastermind who manipulates both the battlefield and enemy minds with equal malevolence. His ability to copy enemy actions, create illusion tokens for strategic teleportation, and control minions transforms him into a terrifying disruptor.'
  },
 {
    id: 29,
    name: 'Ignatia',
    icon: '/heroes/ignatia.png',
    complexity: 4,
    roles: ['Sniper', 'Damager'],
    expansion: 'Renowned',
    description: 'Ignatia is a dual-natured elementalist whose abilities shift dramatically based on which team controls the tiebreaker coin.'
  },
 {
    id: 30,
    name: 'Takahide',
    icon: '/heroes/takahide.png',
    complexity: 4,
    roles: ['Durable', 'Sniper'],
    expansion: 'Wayward',
    description: 'Takahide is a masterful battlefield commander who cycles between three distinct combat styles.'
  },
 {
    id: 31,
    name: 'Emmitt',
    icon: '/heroes/emmitt.png',
    complexity: 4,
    roles: ['Melee', 'Tactician'],
    expansion: 'Wayward',
    description: "Emmitt is a chronological disruptor who bends the very rules of initiative, causing heroes with lower values to act before those with higher in a complete reversal of time's normal flow."
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