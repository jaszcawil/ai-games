// ===================================================================
// player.js -- hero character controller (movement, jump)
// ===================================================================

const GRAVITY = -34;
const MOVE_SPEED = 9;
const JUMP_VELOCITY = 13.5;
const DEATH_Y = -18;

class Player {
  constructor(scene, heroId) {
    this.heroId = heroId;
    this.hero = HEROES.find(h => h.id === heroId) || HEROES[0];
    this.pos = new THREE.Vector3(0, 2, 2);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.grounded = false;
    this.bobT = Math.random() * 10;
    this.squash = 1;
    this.lastCheckpoint = new THREE.Vector3(0, 2, 2);
    this.checkpointIndex = 0;
    this.finished = false;

    const loader = new THREE.TextureLoader();
    const tex = loader.load(this.hero.img);
    tex.magFilter = THREE.LinearFilter;
    this.mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.scale.set(2.1, 2.1, 1);
    this.sprite.position.copy(this.pos);
    scene.add(this.sprite);

    // soft blob shadow
    const shadowGeo = new THREE.CircleGeometry(0.75, 20);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
  }

  setSpawn(pos) {
    this.pos.copy(pos);
    this.lastCheckpoint.copy(pos);
    this.vel.set(0, 0, 0);
  }

  setCheckpoint(pos, index) {
    this.lastCheckpoint.copy(pos);
    this.checkpointIndex = index;
  }

  respawn() {
    this.pos.copy(this.lastCheckpoint);
    this.vel.set(0, 0, 0);
    showToast("Try again! 💪");
  }

  update(dt, platforms) {
    if (this.finished) return;

    const input = InputSystem;
    const mx = input.moveX, mz = input.moveZ;
    const moving = Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05;

    // camera-relative movement: the joystick always means the same thing on screen
    const { forward, right } = CameraRig.getBasis();
    const speed = MOVE_SPEED;
    const moveVec = new THREE.Vector3();
    if (moving) {
      moveVec.addScaledVector(forward, -mz).addScaledVector(right, mx);
      if (moveVec.lengthSq() > 0.0001) moveVec.normalize();
    }
    this.pos.x += moveVec.x * speed * dt;
    this.pos.z += moveVec.z * speed * dt;

    // gravity
    this.vel.y += GRAVITY * dt;
    this.pos.y += this.vel.y * dt;

    // ground collision: find highest platform top below/at player's feet
    let bestTop = -Infinity, onPlatform = null;
    const margin = 0.05;
    for (const p of platforms) {
      const halfW = p.w/2 + margin, halfD = p.d/2 + margin;
      if (this.pos.x > p.x - halfW && this.pos.x < p.x + halfW &&
          this.pos.z > p.z - halfD && this.pos.z < p.z + halfD) {
        const top = p.getTop ? p.getTop() : (p.y + p.h/2);
        if (this.pos.y >= top - 0.55 && top > bestTop) {
          bestTop = top; onPlatform = p;
        }
      }
    }

    if (onPlatform && this.vel.y <= 0.01 && this.pos.y <= bestTop + 0.55) {
      this.pos.y = bestTop;
      this.vel.y = 0;
      if (!this.grounded) { this.squash = 1.35; }
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // fell off the world -> respawn
    if (this.pos.y < DEATH_Y) {
      this.respawn();
      return;
    }

    // jump (pure movement now -- talking/answering has its own TALK button)
    if (input.jumpPressed && this.grounded) {
      this.vel.y = JUMP_VELOCITY;
      this.grounded = false;
      this.squash = 0.7;
    }

    // squash/stretch recovery + idle bob
    this.squash += (1 - this.squash) * Math.min(1, dt * 8);
    this.bobT += dt;
    const bob = this.grounded && moving ? Math.abs(Math.sin(this.bobT * 9)) * 0.08 : Math.sin(this.bobT * 2.4) * 0.03;

    this.sprite.position.set(this.pos.x, this.pos.y + 1.05 + bob, this.pos.z);
    this.sprite.scale.set(2.1 / this.squash, 2.1 * this.squash, 1);

    this.shadow.position.set(this.pos.x, (onPlatform ? bestTop : this.pos.y) + 0.02, this.pos.z);
    const shadowScale = this.grounded ? 1 : Math.max(0.4, 1 - (this.pos.y - (onPlatform?bestTop:0)) * 0.15);
    this.shadow.scale.set(shadowScale, shadowScale, 1);
  }
}
