// ===================================================================
// camera.js -- Emberfall-style third-person orbit camera.
// Fixed-yaw by default; drag to look around; pinch/scroll to zoom;
// movement elsewhere in the game is computed relative to this yaw,
// so the joystick always means "the same thing on screen".
// ===================================================================

const CameraRig = {
  yaw: 0,           // radians, 0 = camera behind player looking toward -Z
  pitch: 0.55,       // radians above horizontal (elevation)
  distance: 10,
  minDistance: 5.5,
  maxDistance: 18,
  minPitch: 0.28,
  maxPitch: 1.05,
  height: 1.3,       // look-at height offset above player feet

  _dragging: false,
  _dragPointerId: null,
  _lastX: 0, _lastY: 0,
  _pointers: new Map(),
  _pinchStartDist: null,
  _pinchStartZoom: null,

  init() {
    const canvas = document.getElementById('gameCanvas');

    canvas.addEventListener('pointerdown', (e) => {
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        this._dragging = true;
        this._dragPointerId = e.pointerId;
        this._lastX = e.clientX; this._lastY = e.clientY;
      } else if (this._pointers.size === 2) {
        this._dragging = false;
        const pts = Array.from(this._pointers.values());
        this._pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        this._pinchStartZoom = this.distance;
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this._pointers.size === 2) {
        const pts = Array.from(this._pointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this._pinchStartDist) {
          const scale = this._pinchStartDist / Math.max(dist, 1);
          this.distance = THREE.MathUtils.clamp(this._pinchStartZoom * scale, this.minDistance, this.maxDistance);
        }
      } else if (this._dragging && e.pointerId === this._dragPointerId) {
        const dx = e.clientX - this._lastX, dy = e.clientY - this._lastY;
        this._lastX = e.clientX; this._lastY = e.clientY;
        this.yaw -= dx * 0.007;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.005, this.minPitch, this.maxPitch);
      }
    });

    const release = (e) => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) { this._pinchStartDist = null; }
      if (e.pointerId === this._dragPointerId) { this._dragging = false; this._dragPointerId = null; }
      if (this._pointers.size === 1) {
        const remaining = Array.from(this._pointers.entries())[0];
        this._dragging = true;
        this._dragPointerId = remaining[0];
        this._lastX = remaining[1].x; this._lastY = remaining[1].y;
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', release);

    canvas.addEventListener('wheel', (e) => {
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.01, this.minDistance, this.maxDistance);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this.recenter();
      if (e.code === 'KeyQ') this.yaw += 0.06;
      if (e.code === 'KeyE') this.yaw -= 0.06;
    });
  },

  recenter() { this.yaw = 0; this.pitch = 0.55; this.distance = 10; },

  // returns the forward/right unit vectors for the current yaw (Y-up world)
  getBasis() {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return { forward, right };
  },

  update(camera, targetPos, dt) {
    const offX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const offZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;
    const offY = Math.sin(this.pitch) * this.distance;
    const desired = new THREE.Vector3(targetPos.x + offX, targetPos.y + offY + 1, targetPos.z + offZ);
    camera.position.lerp(desired, Math.min(1, (dt || 0.016) * 9));
    camera.lookAt(targetPos.x, targetPos.y + this.height, targetPos.z);
  }
};
