// An example SheetDTO for a level 5 Ranger. It matches protocol.md section 6.
// The page uses this data when the URL has "?fixture=1", so a developer can
// see and review the page with no server running.

const FIXTURE = {
  id: 'fixture-aelar',
  name: 'Aelar Windrunner',
  img: '',
  system: 'dnd5e',
  rev: 1,

  header: {
    level: 5,
    classes: 'Ranger 5',
    race: 'Elf',
    background: 'Outlander',
    ac: 16,
    initiative: 4,
    speed: '30 ft',
    prof: 3,
    inspiration: false,
    exhaustion: 1,
  },
  hp: { value: 38, max: 44, temp: 0, tempmax: 0 },
  deathSaves: { success: 0, failure: 0 },

  abilities: [
    { key: 'str', label: 'Strength', value: 12, mod: 1, save: 4, proficient: true },
    { key: 'dex', label: 'Dexterity', value: 18, mod: 4, save: 7, proficient: true },
    { key: 'con', label: 'Constitution', value: 14, mod: 2, save: 2, proficient: false },
    { key: 'int', label: 'Intelligence', value: 10, mod: 0, save: 0, proficient: false },
    { key: 'wis', label: 'Wisdom', value: 16, mod: 3, save: 3, proficient: false },
    { key: 'cha', label: 'Charisma', value: 8, mod: -1, save: -1, proficient: false },
  ],
  skills: [
    { key: 'acr', label: 'Acrobatics', ability: 'dex', mod: 4, proficiency: 0, passive: 14 },
    { key: 'ani', label: 'Animal Handling', ability: 'wis', mod: 6, proficiency: 1, passive: 16 },
    { key: 'arc', label: 'Arcana', ability: 'int', mod: 0, proficiency: 0, passive: 10 },
    { key: 'ath', label: 'Athletics', ability: 'str', mod: 4, proficiency: 1, passive: 14 },
    { key: 'dec', label: 'Deception', ability: 'cha', mod: -1, proficiency: 0, passive: 9 },
    { key: 'his', label: 'History', ability: 'int', mod: 0, proficiency: 0, passive: 10 },
    { key: 'ins', label: 'Insight', ability: 'wis', mod: 3, proficiency: 0, passive: 13 },
    { key: 'itm', label: 'Intimidation', ability: 'cha', mod: -1, proficiency: 0, passive: 9 },
    { key: 'inv', label: 'Investigation', ability: 'int', mod: 0, proficiency: 0, passive: 10 },
    { key: 'med', label: 'Medicine', ability: 'wis', mod: 3, proficiency: 0, passive: 13 },
    { key: 'nat', label: 'Nature', ability: 'int', mod: 0, proficiency: 0, passive: 10 },
    { key: 'prc', label: 'Perception', ability: 'wis', mod: 6, proficiency: 1, passive: 16 },
    { key: 'prf', label: 'Performance', ability: 'cha', mod: -1, proficiency: 0, passive: 9 },
    { key: 'per', label: 'Persuasion', ability: 'cha', mod: -1, proficiency: 0, passive: 9 },
    { key: 'rel', label: 'Religion', ability: 'int', mod: 0, proficiency: 0, passive: 10 },
    { key: 'sle', label: 'Sleight of Hand', ability: 'dex', mod: 4, proficiency: 0, passive: 14 },
    { key: 'ste', label: 'Stealth', ability: 'dex', mod: 7, proficiency: 1, passive: 17 },
    { key: 'sur', label: 'Survival', ability: 'wis', mod: 6, proficiency: 1, passive: 16 },
  ],
  tools: [{ key: 'herb', label: "Herbalism Kit", mod: 3 }],

  resources: [{ key: 'primary', label: 'Favored Foe', value: 2, max: 3 }],
  currency: { pp: 0, gp: 25, ep: 0, sp: 4, cp: 0 },

  attacks: [
    { itemId: 'i1', name: 'Longbow', img: '', toHit: '+7', damage: '1d8+4 piercing', uses: null },
    { itemId: 'i5', name: 'Shortsword', img: '', toHit: '+7', damage: '1d6+4 piercing', uses: null },
  ],
  inventory: [
    { itemId: 'i2', name: 'Rope, Hempen (50 ft)', img: '', type: 'loot', qty: 1, weight: 10, equipped: false, uses: null },
    { itemId: 'i6', name: 'Arrows', img: '', type: 'consumable', qty: 20, weight: 1, equipped: false, uses: null },
    { itemId: 'i7', name: 'Studded Leather Armor', img: '', type: 'equipment', qty: 1, weight: 13, equipped: true, uses: null },
    { itemId: 'i8', name: 'Potion of Healing', img: '', type: 'consumable', qty: 2, weight: 0.5, equipped: false, uses: null },
    { itemId: 'i9', name: 'Torch', img: '', type: 'loot', qty: 5, weight: 1, equipped: false, uses: null },
  ],
  spells: {
    slots: [
      { level: 1, value: 3, max: 4 },
      { level: 2, value: 1, max: 2 },
    ],
    list: [
      { itemId: 'i3', name: "Hunter's Mark", level: 1, school: 'div', prepared: true, uses: null },
      { itemId: 'i10', name: 'Cure Wounds', level: 1, school: 'evo', prepared: true, uses: null },
      { itemId: 'i11', name: 'Pass without Trace', level: 2, school: 'abj', prepared: false, uses: null },
    ],
  },
  features: [
    { itemId: 'i4', name: 'Primeval Awareness', uses: { value: 1, max: 1 } },
    { itemId: 'i12', name: 'Extra Attack', uses: null },
  ],
  conditions: [{ key: 'prone', label: 'Prone', img: '' }],
  notes: {
    biography:
      '<p><strong>Aelar</strong> grew up on the frontier, far from the elf city-states. ' +
      'He tracks, he hunts, and he keeps to himself.</p>',
    trait: 'I judge people by their actions, not their words.',
    ideal: 'Nature does not distinguish between friend and foe.',
    bond: 'My anchor to normalcy is the sword my mentor gave me.',
    flaw: 'I am too enamored with a lifestyle of travel to stay put.',
  },
};

export function fixtureSheet() {
  return structuredClone(FIXTURE);
}
