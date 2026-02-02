const ENTITY_ID_PATTERN = '[a-z0-9_]+\\.[a-z0-9_]+';
const extractWithRegex = (content: string, regex: RegExp, entities: Set<string>): void => {
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const entityId = match[1];
    if (entityId) {
      entities.add(entityId.toLowerCase());
    }
  }
};

export const extractEntitiesFromContent = (content: string): string[] => {
  if (!content) {
    return [];
  }

  const entities = new Set<string>();

  const entityFunctionRegexes = [
    new RegExp(`states\\s*\\(\\s*['"](${ENTITY_ID_PATTERN})['"]\\s*\\)`, 'gi'),
    new RegExp(`is_state\\s*\\(\\s*['"](${ENTITY_ID_PATTERN})['"]\\s*,`, 'gi'),
    new RegExp(`is_state_attr\\s*\\(\\s*['"](${ENTITY_ID_PATTERN})['"]\\s*,`, 'gi'),
    new RegExp(`state_attr\\s*\\(\\s*['"](${ENTITY_ID_PATTERN})['"]\\s*,`, 'gi'),
    new RegExp(`expand\\s*\\(\\s*['"](${ENTITY_ID_PATTERN})['"]\\s*\\)`, 'gi'),
    new RegExp(`device_attr\\s*\\(\\s*['"](${ENTITY_ID_PATTERN})['"]\\s*,`, 'gi'),
    new RegExp(`has_value\\s*\\(\\s*['"](${ENTITY_ID_PATTERN})['"]\\s*\\)`, 'gi'),
  ];

  entityFunctionRegexes.forEach((regex) => extractWithRegex(content, regex, entities));
  extractWithRegex(
    content,
    new RegExp(`states\\s*\\[\\s*['"](${ENTITY_ID_PATTERN})['"]\\s*\\]`, 'gi'),
    entities
  );

  let statesMatch: RegExpExecArray | null;
  const statesDotRegex = new RegExp('states\\.([a-z0-9_]+)\\.([a-z0-9_]+)', 'gi');
  while ((statesMatch = statesDotRegex.exec(content)) !== null) {
    const domain = statesMatch[1];
    const objectId = statesMatch[2];
    if (domain && objectId) {
      entities.add(`${domain}.${objectId}`.toLowerCase());
    }
  }

  const htmlAttributeRegexes = [
    new RegExp(`data-entity\\s*=\\s*['"](${ENTITY_ID_PATTERN})['"]`, 'gi'),
    new RegExp(`\\bentity\\s*=\\s*['"](${ENTITY_ID_PATTERN})['"]`, 'gi'),
    new RegExp(`<ha-entity-picker[^>]*\\bvalue\\s*=\\s*['"](${ENTITY_ID_PATTERN})['"]`, 'gi'),
  ];
  htmlAttributeRegexes.forEach((regex) => extractWithRegex(content, regex, entities));

  return Array.from(entities).sort((a, b) => a.localeCompare(b));
};
