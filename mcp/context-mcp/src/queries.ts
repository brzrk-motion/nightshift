import { type LanguageId } from './types.js';

/**
 * Tree-sitter queries, kept as strings rather than `.scm` files so `tsc` alone
 * produces a runnable `dist/` with no asset-copying step.
 *
 * Every definition pattern captures the whole declaration as
 * `@definition.<kind>` and its identifier as `@name`. Name fields use `(_)`
 * because the dialects disagree on the identifier node type (a class name is
 * `identifier` in JavaScript and `type_identifier` in TypeScript).
 */
const SHARED_DEFINITIONS = `
(function_declaration name: (_) @name) @definition.function
(generator_function_declaration name: (_) @name) @definition.function
(class_declaration name: (_) @name) @definition.class
(method_definition name: (_) @name) @definition.method
(variable_declarator
  name: (identifier) @name
  value: [(arrow_function) (function_expression)]) @definition.function
(variable_declarator name: (identifier) @name) @definition.variable
`;

const TYPESCRIPT_DEFINITIONS = `
(abstract_class_declaration name: (_) @name) @definition.class
(interface_declaration name: (_) @name) @definition.interface
(type_alias_declaration name: (_) @name) @definition.type
(enum_declaration name: (_) @name) @definition.enum
(method_signature name: (_) @name) @definition.method
(abstract_method_signature name: (_) @name) @definition.method
(public_field_definition
  name: (_) @name
  value: [(arrow_function) (function_expression)]) @definition.method
`;

const JAVASCRIPT_DEFINITIONS = `
(field_definition
  property: (_) @name
  value: [(arrow_function) (function_expression)]) @definition.method
`;

const SHARED_REFERENCES = `
[
  (identifier)
  (property_identifier)
  (shorthand_property_identifier)
  (shorthand_property_identifier_pattern)
] @ref
`;

const TYPESCRIPT_REFERENCES = `
(type_identifier) @ref
`;

/** The definition query for a grammar. */
export function definitionQuery(language: LanguageId): string {
  const dialect = language === 'javascript' ? JAVASCRIPT_DEFINITIONS : TYPESCRIPT_DEFINITIONS;
  return `${SHARED_DEFINITIONS}${dialect}`;
}

/**
 * The identifier query for a grammar. Matching on syntax nodes is what keeps
 * comments and string literals out of reference results.
 */
export function referenceQuery(language: LanguageId): string {
  const dialect = language === 'javascript' ? '' : TYPESCRIPT_REFERENCES;
  return `${SHARED_REFERENCES}${dialect}`;
}
