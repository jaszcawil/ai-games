// ===================================================================
// SkeletonUtils.js -- minimal vendored helper for cloning rigged models
// ===================================================================
// Three.js's built-in Object3D.clone(true) structurally duplicates a
// model's node hierarchy (including its Bone nodes), but SkinnedMesh.copy()
// only shallow-copies the `skeleton` reference -- it does NOT rebuild the
// skeleton against the newly cloned bones. The result: every clone of a
// rigged character ends up sharing one Skeleton object that still points
// at the ORIGINAL bones, which are never added to the visible scene (only
// clones are). Since a SkinnedMesh's on-screen shape/position is driven by
// its bones' matrixWorld (not by the mesh node's own .position), this
// makes clones render in the wrong place or not at all.
//
// SkeletonUtils.clone(object) does a normal structural clone, then walks
// the tree a second time to re-bind every SkinnedMesh to a fresh Skeleton
// built from ITS OWN clone's bones (same order, same bind matrices), so
// each clone is fully independent and skins correctly.
const SkeletonUtils = {
  clone(source) {
    const cloneLookup = new Map();
    const clonedRoot = source.clone(true);

    // source and clonedRoot have identical structure/child order (that's
    // what Object3D.clone(true) guarantees) -- walk them in lockstep to
    // build a source-node -> cloned-node correspondence.
    (function mapNodes(a, b) {
      cloneLookup.set(a, b);
      for (let i = 0; i < a.children.length; i++) mapNodes(a.children[i], b.children[i]);
    })(source, clonedRoot);

    source.traverse((node) => {
      if (!node.isSkinnedMesh) return;
      const clonedNode = cloneLookup.get(node);
      const clonedBones = node.skeleton.bones.map((bone) => cloneLookup.get(bone));
      // boneInverses are static per-bone bind-pose matrices, independent of
      // which Object3D instance represents each bone -- safe to reuse as-is.
      const newSkeleton = new THREE.Skeleton(clonedBones, node.skeleton.boneInverses);
      clonedNode.bind(newSkeleton, node.bindMatrix);
    });

    return clonedRoot;
  }
};
