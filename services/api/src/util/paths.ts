/**
 * Input-safety helpers.
 *
 * Route params (project ids, asset/render filenames, audio ids) are interpolated
 * into filesystem paths (and redis keys). They are server-generated and so always
 * match a safe pattern, but a malformed/hostile value (`..`, `/`, `\`, NUL) must
 * never be allowed to escape the data directory. `isSafeSegment` rejects anything
 * that is not a single, traversal-free path component.
 */

/** True if `seg` is a single safe path component: no separators, no `..`, no NUL. */
export function isSafeSegment(seg: unknown): seg is string {
  return (
    typeof seg === 'string' &&
    seg.length > 0 &&
    seg.length < 256 &&
    /^[A-Za-z0-9._-]+$/.test(seg) &&
    !seg.includes('..')
  );
}

/**
 * True if `name` is a valid Manim scene class name (a Python identifier).
 *
 * The render-code endpoint forwards `sceneName` to the `manim` CLI as a positional
 * argument. The list-form `subprocess.run` in the renderer prevents shell injection,
 * but an unvalidated value (e.g. `--config_file=…` or one starting with `-`) would be
 * read by manim as a FLAG (argument injection). A scene name is always a Python class
 * identifier, so restrict it to exactly that.
 */
export function isSafeSceneName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length < 256 &&
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
  );
}
