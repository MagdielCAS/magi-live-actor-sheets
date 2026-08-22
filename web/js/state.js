// Holds the current SheetDTO. A local edit changes it right away. A new
// snapshot from the server replaces it completely (protocol.md section 10).

let sheet = null;

export function getSheet() {
  return sheet;
}

export function setSheet(dto) {
  sheet = dto;
}

// Change the current sheet in place, before the server confirms the write.
// mutate receives the live sheet object and edits it directly.
export function applyLocal(mutate) {
  if (!sheet) return;
  mutate(sheet);
}
