// IRON TIDE — input: keyboard state with edge detection. The game polls
// held keys every step and asks "was this just pressed?" for one-shot
// actions (enter car, punch, radio, weapon swap). Pointer lock is not
// used — the mouse only steers the camera when the player drags.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.dragX = 0;
    this.dragging = false;
    this._lastX = 0;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.pressed.clear(); });
    const canvas = document.getElementById('gl');
    canvas.addEventListener('mousedown', (e) => { this.dragging = true; this._lastX = e.clientX; });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) { this.dragX += e.clientX - this._lastX; this._lastX = e.clientX; }
    });
  }
  held(...codes) { return codes.some((c) => this.keys.has(c)); }
  tap(...codes) { return codes.some((c) => this.pressed.has(c)); }
  consume() { this.pressed.clear(); this.dragX = 0; }
  axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); }
}
