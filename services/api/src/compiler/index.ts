/**
 * Manim Studio Compiler
 *
 * Compiles project JSON to Manim Python code.
 * Pipeline: Validate -> Normalize -> Codegen
 */

import { validateProject } from './validator.js';
import { normalizeProject } from './normalizer.js';
import { generatePythonCode } from './codegen.js';

export type CompileResult = { success: true; code: string } | { success: false; errors: string[] };

/**
 * Compile a project JSON to Manim Python code.
 */
export function compileProject(project: unknown, assetsBasePath: string): CompileResult {
  // Step 1: Validate
  const validation = validateProject(project);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Step 2: Normalize
  const normalized = normalizeProject(project);

  // Step 3: Generate Python code
  const code = generatePythonCode(normalized, assetsBasePath);

  return {
    success: true,
    code,
  };
}

export { validateProject, normalizeProject, generatePythonCode };
