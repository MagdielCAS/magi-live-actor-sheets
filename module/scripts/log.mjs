// One place for module messages, so the console shows where they come from.

const PREFIX = "Magi Live Actor Sheets |";

export const log = {
  info: (...args) => console.log(PREFIX, ...args),
  warn: (...args) => console.warn(PREFIX, ...args),
  error: (...args) => console.error(PREFIX, ...args),
  debug: (...args) => console.debug(PREFIX, ...args),
};
