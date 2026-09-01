// ===================================================================
// input.js -- unified input: touch joystick, keyboard, gamepad
// ===================================================================

const InputSystem = {
  moveX: 0, moveZ: 0,           // -1..1 each, world-space (Z forward is negative)
  jumpPressed: false,           // edge-triggered (consumed each frame) -- pure movement, no longer doubles as "talk"
  jumpHeld: false,
  actionPressed: false,         // edge-triggered -- the TALK/ACTION button: greet chiefs, answer questions
  pausePressed: false,

  _keys: {},
  _joystickActive: false,
  _joystickId: null,
  _joyCenter: { x: 0, y: 0 },
  _joyVec: { x: 0, y: 0 },
  _gamepadIndex: null,
  _lastAPressed: false,
  _lastXPressed: false,
  _lastStartPressed: false,

  init() {
    // Disable the browser's right-click context menu across the whole page --
    // mouse drag (any button) orbits the camera (see camera.js), so the
    // native menu popping up on a right-click is disruptive during play.
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard
    window.addEventListener('keydown', (e) => {
      this._keys[e.code] = true;
      if (e.code === 'Space') { this._consumeJumpNext = true; }
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') { this._consumeActionNext = true; }
      if (e.code === 'Escape' || e.code === 'KeyP') { this._consumePauseNext = true; }
    });
    window.addEventListener('keyup', (e) => { this._keys[e.code] = false; });

    // Touch joystick
    const zone = document.getElementById('joystickZone');
    const nub = document.getElementById('joystickNub');
    const base = document.getElementById('joystickBase');

    const startJoy = (id, clientX, clientY) => {
      this._joystickActive = true;
      this._joystickId = id;
      const rect = base.getBoundingClientRect();
      this._joyCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
      this._joyRadius = rect.width/2;
      updateJoy(clientX, clientY);
    };
    const updateJoy = (clientX, clientY) => {
      let dx = clientX - this._joyCenter.x;
      let dy = clientY - this._joyCenter.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const max = this._joyRadius;
      if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
      this._joyVec = { x: dx / max, y: dy / max };
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const endJoy = () => {
      this._joystickActive = false;
      this._joystickId = null;
      this._joyVec = { x: 0, y: 0 };
      nub.style.transform = 'translate(0px, 0px)';
    };

    zone.addEventListener('pointerdown', (e) => {
      zone.setPointerCapture(e.pointerId);
      startJoy(e.pointerId, e.clientX, e.clientY);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (this._joystickActive && e.pointerId === this._joystickId) {
        updateJoy(e.clientX, e.clientY);
      }
      e.preventDefault();
    });
    const releaseHandler = (e) => {
      if (e.pointerId === this._joystickId) endJoy();
    };
    zone.addEventListener('pointerup', releaseHandler);
    zone.addEventListener('pointercancel', releaseHandler);
    zone.addEventListener('pointerleave', (e) => { /* keep active until pointerup for drag-off support */ });

    // Jump / action (talk-and-answer) buttons
    const btnJump = document.getElementById('btnJump');
    const btnAction = document.getElementById('btnAction');
    btnJump.addEventListener('pointerdown', (e) => { this._consumeJumpNext = true; this._touchJumpHeld = true; e.preventDefault(); });
    btnJump.addEventListener('pointerup', (e) => { this._touchJumpHeld = false; });
    btnJump.addEventListener('pointercancel', (e) => { this._touchJumpHeld = false; });
    btnAction.addEventListener('pointerdown', (e) => { this._consumeActionNext = true; e.preventDefault(); });

    // Gamepad connect
    window.addEventListener('gamepadconnected', (e) => {
      this._gamepadIndex = e.gamepad.index;
      showToast(`🎮 Controller connected: ${e.gamepad.id.substring(0,28)}`);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this._gamepadIndex === e.gamepad.index) this._gamepadIndex = null;
    });
  },

  // called once per frame
  update() {
    let mx = 0, mz = 0;

    // Keyboard
    if (this._keys['KeyA'] || this._keys['ArrowLeft']) mx -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) mx += 1;
    if (this._keys['KeyW'] || this._keys['ArrowUp']) mz -= 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown']) mz += 1;

    // Touch joystick
    if (this._joystickActive) {
      mx += this._joyVec.x;
      mz += this._joyVec.y;
    }

    // Gamepad
    if (this._gamepadIndex !== null) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads[this._gamepadIndex];
      if (gp) {
        const ax0 = gp.axes[0] || 0, ax1 = gp.axes[1] || 0;
        if (Math.abs(ax0) > 0.15) mx += ax0;
        if (Math.abs(ax1) > 0.15) mz += ax1;
        const aPressed = gp.buttons[0] && gp.buttons[0].pressed; // A / Cross = jump
        const xPressed = gp.buttons[2] && gp.buttons[2].pressed; // X / Square = talk / answer
        const startPressed = gp.buttons[9] && gp.buttons[9].pressed;
        if (aPressed && !this._lastAPressed) this._consumeJumpNext = true;
        if (xPressed && !this._lastXPressed) this._consumeActionNext = true;
        if (startPressed && !this._lastStartPressed) this._consumePauseNext = true;
        this._lastAPressed = aPressed;
        this._lastXPressed = xPressed;
        this._lastStartPressed = startPressed;
        this._gamepadJumpHeld = aPressed;
      }
    }
    this.jumpHeld = !!this._touchJumpHeld || !!this._gamepadJumpHeld || !!this._keys['Space'];

    mx = Math.max(-1, Math.min(1, mx));
    mz = Math.max(-1, Math.min(1, mz));
    this.moveX = mx;
    this.moveZ = mz;

    this.jumpPressed = !!this._consumeJumpNext;
    this._consumeJumpNext = false;
    this.actionPressed = !!this._consumeActionNext;
    this._consumeActionNext = false;
    this.pausePressed = !!this._consumePauseNext;
    this._consumePauseNext = false;
  },

  showTouchControls(show) {
    document.getElementById('touchControls').classList.toggle('hidden', !show);
  }
};
