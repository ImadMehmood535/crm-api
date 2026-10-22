/** The frontend's slug rule (also enforced by the organizations table CHECK). */
export const SLUG_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE = 'Use lowercase letters, numbers and single hyphens.';
