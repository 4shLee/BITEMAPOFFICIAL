export type WhoCategory = 'I' | 'II' | 'III';
export type ExposureContactType = 'touching_or_feeding' | 'lick' | 'nibbling' | 'scratch' | 'bite' | 'bat_contact' | 'other';

export type WhoExposureAssessment = {
  exposureContactTypes: ExposureContactType[];
  exposureSkinCondition: '' | 'intact' | 'broken' | 'unknown';
  exposureBleedingPresent: '' | 'yes' | 'no';
  exposureTransdermal: '' | 'yes' | 'no';
  exposureSalivaContactSite: '' | 'none' | 'intact_skin' | 'broken_skin' | 'mucous_membrane' | 'unknown';
  exposureDirectBatContact: '' | 'yes' | 'no';
};

export type WhoExposureSuggestion = {
  category: WhoCategory | null;
  reason: string | null;
  state: 'complete' | 'incomplete' | 'contradictory';
};

const boolValue = (value: '' | 'yes' | 'no') => value === '' ? null : value === 'yes';

export function classifyWhoExposure(assessment: WhoExposureAssessment): WhoExposureSuggestion {
  const contactTypes = [...new Set(assessment.exposureContactTypes)];
  if (!contactTypes.length) return unable('incomplete');

  const skin = assessment.exposureSkinCondition || null;
  const bleeding = boolValue(assessment.exposureBleedingPresent);
  const transdermal = boolValue(assessment.exposureTransdermal);
  const salivaSite = assessment.exposureSalivaContactSite || null;
  const directBat = boolValue(assessment.exposureDirectBatContact);
  const hasWound = contactTypes.includes('bite') || contactTypes.includes('scratch');

  if (
    (hasWound && ((skin === 'intact' && (transdermal === true || bleeding === true)) || (skin === 'broken' && bleeding === true && transdermal === false)))
    || (!contactTypes.includes('lick') && ![null, 'none'].includes(salivaSite))
    || (!contactTypes.includes('bat_contact') && directBat === true)
  ) {
    return unable('contradictory');
  }

  const applicable: Array<{ category: WhoCategory; reason: string }> = [];

  if (contactTypes.includes('bat_contact')) {
    if (directBat === null) return unable('incomplete');
    if (directBat) applicable.push({ category: 'III', reason: 'Direct physical contact with a bat is classified as severe exposure.' });
  }

  if (contactTypes.includes('lick')) {
    if (!['intact_skin', 'broken_skin', 'mucous_membrane'].includes(salivaSite || '')) return unable('incomplete');
    if (salivaSite === 'broken_skin') applicable.push({ category: 'III', reason: 'Animal saliva contacted broken skin.' });
    else if (salivaSite === 'mucous_membrane') applicable.push({ category: 'III', reason: 'Animal saliva contacted a mucous membrane.' });
    else applicable.push({ category: 'I', reason: 'Animal lick occurred only on intact skin.' });
  }

  if (contactTypes.includes('bite')) {
    if (!['intact', 'broken'].includes(skin || '') || transdermal === null || bleeding === null) return unable('incomplete');
    if (transdermal && skin === 'broken') applicable.push({ category: 'III', reason: 'Transdermal bite with broken skin.' });
    else return unable('incomplete');
  }

  if (contactTypes.includes('scratch')) {
    if (!['intact', 'broken'].includes(skin || '') || transdermal === null || bleeding === null) return unable('incomplete');
    if (transdermal && skin === 'broken') applicable.push({ category: 'III', reason: 'Transdermal scratch with broken skin.' });
    else if (skin === 'broken' && !transdermal && !bleeding) applicable.push({ category: 'II', reason: 'Minor scratch or abrasion occurred without bleeding.' });
    else return unable('incomplete');
  }

  if (contactTypes.includes('nibbling')) applicable.push({ category: 'II', reason: 'Nibbling of uncovered skin occurred.' });
  if (contactTypes.includes('touching_or_feeding')) applicable.push({ category: 'I', reason: 'Contact was limited to touching or feeding the animal.' });
  if (contactTypes.includes('other') || !applicable.length) return unable('incomplete');

  const rank: Record<WhoCategory, number> = { I: 1, II: 2, III: 3 };
  applicable.sort((left, right) => rank[right.category] - rank[left.category]);
  return { ...applicable[0], state: 'complete' };
}

function unable(state: 'incomplete' | 'contradictory'): WhoExposureSuggestion {
  return { category: null, reason: null, state };
}

export const exposureContactOptions: Array<{ value: ExposureContactType; label: string; helper: string }> = [
  { value: 'touching_or_feeding', label: 'Touching or feeding', helper: 'Contact only; no wound or saliva exposure.' },
  { value: 'lick', label: 'Animal lick / saliva contact', helper: 'Follow-up asks where saliva made contact.' },
  { value: 'nibbling', label: 'Nibbling of uncovered skin', helper: 'Superficial contact with uncovered skin.' },
  { value: 'scratch', label: 'Scratch or abrasion', helper: 'Follow-up checks skin break, bleeding, and depth.' },
  { value: 'bite', label: 'Bite', helper: 'A bite is not classified until skin penetration is recorded.' },
  { value: 'bat_contact', label: 'Bat contact', helper: 'Follow-up confirms direct physical contact.' },
  { value: 'other', label: 'Other / unclear contact', helper: 'Requires manual clinical assessment.' },
];

export function exposureContactLabel(value: string) {
  return exposureContactOptions.find((option) => option.value === value)?.label || value;
}
