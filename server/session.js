export const SESSION_MAX_AGE = 90 * 24 * 60 * 60;
export const sessionExpires = () => Date.now() + SESSION_MAX_AGE * 1000;
