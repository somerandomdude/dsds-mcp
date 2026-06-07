import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

/**
 * Extracts all entities from a parsed DSDS document.
 * Resolves $ref entries in the documentation array relative to baseDir.
 * visited prevents circular references.
 */
async function extractEntities(doc, baseDir, visited) {
  if (doc.entity) return [doc.entity];
  if (!Array.isArray(doc.documentation)) return [];

  const entities = [];
  for (const group of doc.documentation) {
    if (group.$ref) {
      entities.push(...await resolveRef(group.$ref, baseDir, visited));
      continue;
    }
    for (const key of ['components', 'patterns', 'styles', 'themes', 'tokens', 'tokenGroups']) {
      if (Array.isArray(group[key])) entities.push(...group[key]);
    }
  }
  return entities;
}

/**
 * Resolves a $ref string to a list of entities.
 * Handles both whole-file refs ("./tokens.dsds.json") and
 * fragment refs ("./button.dsds.json#/entity").
 */
async function resolveRef(ref, baseDir, visited) {
  const hashIdx = ref.indexOf('#');
  const filePart = hashIdx >= 0 ? ref.slice(0, hashIdx) : ref;
  const fragment = hashIdx >= 0 ? ref.slice(hashIdx + 1) : null;

  if (!filePart) return [];

  const absPath = resolve(baseDir, filePart);
  if (visited.has(absPath)) return [];

  let raw;
  try {
    raw = await readFile(absPath, 'utf-8');
  } catch {
    return [];
  }

  const doc = JSON.parse(raw);
  const newVisited = new Set([...visited, absPath]);

  if (fragment) {
    const value = resolvePointer(doc, fragment);
    if (!value) return [];
    if (value.kind) return [value];
    return extractEntities(value, dirname(absPath), newVisited);
  }

  return extractEntities(doc, dirname(absPath), newVisited);
}

/** Resolves a JSON Pointer fragment (e.g. "/entity") against a document. */
function resolvePointer(doc, fragment) {
  const pointer = fragment.startsWith('/') ? fragment.slice(1) : fragment;
  if (!pointer) return doc;
  return pointer.split('/').reduce((obj, key) => obj?.[key], doc);
}

async function loadFile(filePath) {
  const absPath = resolve(filePath);
  const raw = await readFile(absPath, 'utf-8');
  const document = JSON.parse(raw);
  const entities = await extractEntities(document, dirname(absPath), new Set([absPath]));
  return { filePath: absPath, document, entities };
}

export async function loadSystems(paths) {
  const systems = [];
  const errors = [];

  await Promise.all(
    paths.map(async p => {
      try {
        systems.push(await loadFile(p));
      } catch (err) {
        errors.push({ path: p, error: err.message });
      }
    })
  );

  return { systems, errors };
}

export function summarizeEntities(systems) {
  return systems.flatMap(system =>
    system.entities.map(entity => ({
      identifier: entity.identifier,
      name: entity.name ?? entity.identifier,
      kind: entity.kind,
      status: resolveStatus(entity.metadata?.status),
      summary: resolveText(entity.metadata?.summary),
      tags: entity.metadata?.tags ?? [],
      filePath: system.filePath,
    }))
  );
}

function resolveStatus(status) {
  if (!status) return undefined;
  if (typeof status === 'string') return status;
  return status.value ?? undefined;
}

function resolveText(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.value ?? undefined;
}
