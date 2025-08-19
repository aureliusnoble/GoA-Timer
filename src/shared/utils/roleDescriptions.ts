// src/shared/utils/roleDescriptions.ts

export interface RoleDescription {
  name: string;
  description: string;
  shortDescription: string;
}

export const roleDescriptions: Record<string, RoleDescription> = {
  guardian: {
    name: 'Guardian',
    description: 'Tanky defenders who protect allies and control space on the battlefield',
    shortDescription: 'Protects allies from damage and controls battlefield positioning'
  },
  durable: {
    name: 'Durable',
    description: 'Tough heroes with high survivability and defensive capabilities',
    shortDescription: 'Survives extended fights and outlasts enemies with defensive abilities'
  },
  slayer: {
    name: 'Slayer',
    description: 'High damage dealers who excel at eliminating enemy heroes',
    shortDescription: 'Eliminates enemy heroes quickly with high damage output and burst'
  },
  tactician: {
    name: 'Tactician',
    description: 'Strategic heroes with strong positioning and battlefield control',
    shortDescription: 'Controls battles through strategic positioning and tactical battlefield awareness'
  },
  support: {
    name: 'Support',
    description: 'Team utility specialists who heal, buff allies, and provide assistance',
    shortDescription: 'Heals allies and provides team utility through buffs and assistance'
  },
  sorcerer: {
    name: 'Sorcerer',
    description: 'Magic damage dealers with powerful spells and area control',
    shortDescription: 'Casts powerful magic spells for damage and area battlefield control'
  },
  disabler: {
    name: 'Disabler',
    description: 'Heroes who control enemies through stuns, roots, and debuffs',
    shortDescription: 'Disrupts enemies with stuns, roots, and debuffs to control fights'
  },
  pusher: {
    name: 'Pusher',
    description: 'Heroes who excel at destroying structures and advancing lanes',
    shortDescription: 'Destroys enemy structures and advances lanes to gain map control'
  },
  farming: {
    name: 'Farming',
    description: 'Heroes who efficiently gather resources and scale into late game',
    shortDescription: 'Gathers resources efficiently to become powerful in late game scenarios'
  }
};

/**
 * Get role description for tooltip display
 */
export const getRoleTooltip = (role: string): string => {
  const roleKey = role.toLowerCase();
  const roleInfo = roleDescriptions[roleKey];
  
  if (roleInfo) {
    return `${roleInfo.name}: ${roleInfo.shortDescription}`;
  }
  
  // Fallback for unknown roles
  return role.charAt(0).toUpperCase() + role.slice(1);
};

/**
 * Get detailed role description
 */
export const getRoleDescription = (role: string): string => {
  const roleKey = role.toLowerCase();
  const roleInfo = roleDescriptions[roleKey];
  
  return roleInfo ? roleInfo.description : 'Unknown role';
};