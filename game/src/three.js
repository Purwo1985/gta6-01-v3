// IRON TIDE — three: the one doorway to the vendored three.js module.
// index.html maps the bare specifier "three" to ./vendor/three.module.min.js
// through an import map, so every game module imports from 'three' and
// never touches window globals. If the import map fails, boot dies here
// with a readable error instead of halfway through city building.
import * as THREE from 'three';

if (!THREE || typeof THREE.WebGLRenderer !== 'function') {
  throw new Error('three.js failed to load — check game/vendor/three.module.min.js');
}

export { THREE };
export default THREE;
