/**
 * @fileoverview Variable type definitions
 * @description Defines variable pointers and persistent variables for Record-Replay V3
 */

import type { JsonValue, UnixMillis } from './json';

/** Variable name */
export type VariableName = string;

/** Persistent variable name (prefixed with $) */
export type PersistentVariableName = `$${string}`;

/** Variable scope */
export type VariableScope = 'run' | 'flow' | 'persistent';

/**
 * Variable pointer
 * @description Reference to a variable, supports JSON path access
 */
export interface VariablePointer {
  /** Variable scope */
  scope: VariableScope;
  /** Variable name */
  name: VariableName;
  /** JSON path (for accessing nested properties) */
  path?: ReadonlyArray<string | number>;
}

/**
 * Variable definition
 * @description Variables declared in a Flow
 */
export interface VariableDefinition {
  /** Variable name */
  name: VariableName;
  /** Display label */
  label?: string;
  /** Description */
  description?: string;
  /** Whether sensitive (not displayed/exported) */
  sensitive?: boolean;
  /** Whether required */
  required?: boolean;
  /** Default value */
  default?: JsonValue;
  /** Scope (excludes persistent; persistent is determined by $ prefix) */
  scope?: Exclude<VariableScope, 'persistent'>;
}

/**
 * Persistent variable record
 * @description Persistent variable stored in IndexedDB
 */
export interface PersistentVarRecord {
  /** Variable key (prefixed with $) */
  key: PersistentVariableName;
  /** Variable value */
  value: JsonValue;
  /** Last updated time */
  updatedAt: UnixMillis;
  /** Version number (monotonically increasing, for LWW and debugging) */
  version: number;
}

/**
 * Check if a variable name is a persistent variable
 */
export function isPersistentVariable(name: string): name is PersistentVariableName {
  return name.startsWith('$');
}

/**
 * Parse a variable pointer string
 * @example "$user.name" -> { scope: 'persistent', name: '$user', path: ['name'] }
 */
export function parseVariablePointer(ref: string): VariablePointer | null {
  if (!ref) return null;

  const parts = ref.split('.');
  const name = parts[0];
  const path = parts.slice(1);

  if (isPersistentVariable(name)) {
    return {
      scope: 'persistent',
      name,
      path: path.length > 0 ? path : undefined,
    };
  }

  // Default to run scope
  return {
    scope: 'run',
    name,
    path: path.length > 0 ? path : undefined,
  };
}
