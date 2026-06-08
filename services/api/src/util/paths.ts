/**
 * Path-safety helpers.
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
