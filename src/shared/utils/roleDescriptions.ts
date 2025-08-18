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
    shortDescription: 'Tank and protector'
  },
  durable: {
    name: 'Durable',
    description: 'Tough heroes with high survivability and defensive capabilities',
    shortDescription: 'High survivability'
  },
  slayer: {
    name: 'Slayer',
    description: 'High damage dealers who excel at eliminating enemy heroes',
    shortDescription: 'High damage dealer'
  },
  tactician: {
    name: 'Tactician',
    description: 'Strategic heroes with strong positioning and battlefield control',
    shortDescription: 'Strategic positioning'
  },
  support: {
    name: 'Support',
    description: 'Team utility specialists who heal, buff allies, and provide assistance',
    shortDescription: 'Team utility and healing'
  },
  sorcerer: {
    name: 'Sorcerer',
    description: 'Magic damage dealers with powerful spells and area control',
    shortDescription: 'Magic damage and control'
  },
  disabler: {
    name: 'Disabler',
    description: 'Heroes who control enemies through stuns, roots, and debuffs',
    shortDescription: 'Crowd control specialist'
  },
  pusher: {
    name: 'Pusher',
    description: 'Heroes who excel at destroying structures and advancing lanes',
    shortDescription: 'Structure destroyer'
  },
  farming: {
    name: 'Farming',
    description: 'Heroes who efficiently gather resources and scale into late game',
    shortDescription: 'Resource gatherer'
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