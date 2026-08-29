// ===================================================================
// input.js -- unified input: touch joystick, keyboard, gamepad
// ===================================================================

const InputSystem = {
  moveX: 0, moveZ: 0,           // -1..1 each, world-space (Z forward is negative)
  jumpPressed: false,           // edge-triggered (consumed each frame)
  jumpHeld: false,
  abilityPressed: false,        // edge-triggered
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
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this._keys[e.code] = true;
      if (e.code === 'Space') { this._consumeJumpNext = true; }
      if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { this._consumeAbilityNext = true; }
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

    // Jump / ability buttons
    const btnJump = document.getElementById('btnJump');
    const btnAbility = document.getElementById('btnAbility');
    btnJump.addEventListener('pointerdown', (e) => { this._consumeJumpNext = true; this._touchJumpHeld = true; e.preventDefault(); });
    btnJump.addEventListener('pointerup', (e) => { this._touchJumpHeld = false; });
    btnJump.addEventListener('pointercancel', (e) => { this._touchJumpHeld = false; });
    btnAbility.addEventListener('pointerdown', (e) => { this._consumeAbilityNext = true; e.preventDefault(); });

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
        const aPressed = gp.buttons[0] && gp.buttons[0].pressed; // A / Cross
        const xPressed = gp.buttons[2] && gp.buttons[2].pressed; // X / Square
        const startPressed = gp.buttons[9] && gp.buttons[9].pressed;
        if (aPressed && !this._lastAPressed) this._consumeJumpNext = true;
        if (xPressed && !this._lastXPressed) this._consumeAbilityNext = true;
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
    this.abilityPressed = !!this._consumeAbilityNext;
    this._consumeAbilityNext = false;
    this.pausePressed = !!this._consumePauseNext;
    this._consumePauseNext = false;
  },

  showTouchControls(show) {
    document.getElementById('touchControls').classList.toggle('hidden', !show);
  }
};
