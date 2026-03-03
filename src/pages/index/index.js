import './index.css';
import template from './index.html?raw';
import * as THREE from 'three';

let cleanupHomeScene = null;

export function renderIndexPage() {
  return template;
}

export function onMountIndexPage() {
  const host = document.querySelector('#home-three-canvas');
  if (!host) {
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dff4ff');

  const camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 100);
  camera.position.set(0, 0.35, 8.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  host.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight('#ffffff', 1);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight('#9dd3ff', 1.2);
  directional.position.set(2.8, 5.1, 2.2);
  scene.add(directional);

  const backGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 8),
    new THREE.MeshBasicMaterial({ color: '#c7ecff' })
  );
  backGlow.position.set(0, 0.4, -3.2);
  scene.add(backGlow);

  const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#f5fdff', transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let index = 0; index < 8; index += 1) {
    const cloud = new THREE.Mesh(new THREE.CircleGeometry(0.45 + Math.random() * 0.35, 24), cloudMaterial);
    cloud.position.set(-5.5 + index * 1.55, 1.8 + Math.sin(index) * 0.5, -2.7);
    cloud.scale.set(1.4 + Math.random() * 0.8, 0.7 + Math.random() * 0.25, 1);
    scene.add(cloud);
    clouds.push({ mesh: cloud, phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.45 });
  }

  const sparkleGeometry = new THREE.BufferGeometry();
  const sparkleCount = 120;
  const sparklePositions = new Float32Array(sparkleCount * 3);
  for (let index = 0; index < sparkleCount; index += 1) {
    sparklePositions[index * 3] = (Math.random() - 0.5) * 14;
    sparklePositions[index * 3 + 1] = Math.random() * 5 - 0.8;
    sparklePositions[index * 3 + 2] = -2.9 + Math.random() * 0.5;
  }
  sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
  const sparkles = new THREE.Points(
    sparkleGeometry,
    new THREE.PointsMaterial({ color: '#ffffff', size: 0.04, transparent: true, opacity: 0.75 })
  );
  scene.add(sparkles);

  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 0.05, -0.7);
  scene.add(boardGroup);

  const boardFrameMaterial = new THREE.MeshStandardMaterial({
    color: '#f5fcff',
    roughness: 0.45,
    metalness: 0.06
  });
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.6, 0.12), boardFrameMaterial);
  boardGroup.add(boardFrame);

  const boardInnerMaterial = new THREE.MeshStandardMaterial({ color: '#effaff', roughness: 0.5, metalness: 0.03 });
  const boardInner = new THREE.Mesh(new THREE.BoxGeometry(7.1, 3.25, 0.08), boardInnerMaterial);
  boardInner.position.z = 0.04;
  boardGroup.add(boardInner);

  const columnHeaderMaterials = [
    new THREE.MeshStandardMaterial({ color: '#7db8f8', roughness: 0.35, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: '#93c5fd', roughness: 0.35, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: '#86efac', roughness: 0.35, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: '#c4b5fd', roughness: 0.35, metalness: 0.1 })
  ];

  const boardColumns = [];
  const boardCards = [];
  const columnBodyMaterials = [];
  const boardWidth = 1.55;
  const columnGap = 0.2;

  for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
    const column = new THREE.Group();
    const xOffset = (columnIndex - 1.5) * (boardWidth + columnGap);
    column.position.set(xOffset, -0.05, 0.1);

    const columnBodyMaterial = new THREE.MeshStandardMaterial({
      color: '#e8f6ff',
      roughness: 0.45,
      metalness: 0.04
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(boardWidth, 2.82, 0.05), columnBodyMaterial);
    columnBodyMaterials.push(columnBodyMaterial);
    column.add(body);

    const header = new THREE.Mesh(new THREE.BoxGeometry(boardWidth, 0.3, 0.07), columnHeaderMaterials[columnIndex]);
    header.position.set(0, 1.23, 0.05);
    column.add(header);

    for (let cardIndex = 0; cardIndex < 8; cardIndex += 1) {
      const cardMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.22, 0.2, 0.02),
        new THREE.MeshStandardMaterial({
          color: cardIndex % 2 === 0 ? '#ffffff' : '#ddf2ff',
          roughness: 0.45,
          metalness: 0.03
        })
      );

      const row = Math.floor(cardIndex / 2);
      const rowPos = 0.84 - row * 0.53;
      const xJitter = (cardIndex % 2 - 0.5) * 0.2;
      cardMesh.position.set(xJitter, rowPos, 0.08);
      cardMesh.rotation.z = (Math.random() - 0.5) * 0.03;
      column.add(cardMesh);

      boardCards.push({
        mesh: cardMesh,
        baseX: xJitter,
        baseY: rowPos,
        phase: Math.random() * Math.PI * 2,
        speed: 0.7 + Math.random() * 0.8
      });
    }

    boardGroup.add(column);
    boardColumns.push(column);
  }

  const deskMaterial = new THREE.MeshStandardMaterial({ color: '#d8f0ff', roughness: 0.55, metalness: 0.05 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.45, 1.4), deskMaterial);
  desk.position.set(0, -2.05, 0.5);
  scene.add(desk);

  const laptopMaterial = new THREE.MeshStandardMaterial({ color: '#9dd4ff', roughness: 0.35, metalness: 0.2 });
  const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.2), laptopMaterial);
  laptopBase.position.set(-0.35, -1.7, 0.5);
  scene.add(laptopBase);
  const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.15, 0.08), laptopMaterial);
  laptopScreen.position.set(-0.35, -1.15, 0.1);
  laptopScreen.rotation.x = -0.42;
  scene.add(laptopScreen);

  const noteGeometry = new THREE.BoxGeometry(0.34, 0.24, 0.02);
  const noteMaterials = [
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: '#d8ecff', roughness: 0.45, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: '#d9fbe5', roughness: 0.45, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: '#efe4ff', roughness: 0.45, metalness: 0.05 })
  ];

  const notes = [];
  const noteCount = 64;

  const resetNote = (noteData, withRandomX = false) => {
    const startX = withRandomX ? (Math.random() - 0.5) * 13 : -7.2 + Math.random() * 1.1;
    noteData.mesh.position.set(startX, -0.9 + Math.random() * 3.4, -0.2 + Math.random() * 1.5);
    noteData.speed = 0.008 + Math.random() * 0.016;
    noteData.drift = (Math.random() - 0.5) * 0.01;
    noteData.spin = (Math.random() - 0.5) * 0.022;
    noteData.wave = Math.random() * Math.PI * 2;
  };

  for (let index = 0; index < noteCount; index += 1) {
    const material = noteMaterials[index % noteMaterials.length];
    const mesh = new THREE.Mesh(noteGeometry, material);
    const noteData = {
      mesh,
      speed: 0,
      drift: 0,
      spin: 0,
      wave: 0
    };

    resetNote(noteData, true);
    mesh.rotation.set(Math.random() * 0.6, Math.random() * 0.6, Math.random() * 0.6);
    scene.add(mesh);
    notes.push(noteData);
  }

  let rafId;
  const animate = () => {
    const time = performance.now() * 0.001;

    boardGroup.rotation.y = Math.sin(time * 0.28) * 0.035;
    boardGroup.position.y = Math.sin(time * 0.7) * 0.03;
    boardColumns.forEach((column, index) => {
      column.position.y = -0.05 + Math.sin(time * 0.9 + index * 0.7) * 0.035;
      column.rotation.z = Math.sin(time * 0.3 + index) * 0.006;
    });

    boardCards.forEach((card) => {
      card.mesh.position.y = card.baseY + Math.sin(time * card.speed + card.phase) * 0.02;
      card.mesh.position.x = card.baseX + Math.cos(time * (card.speed * 0.7) + card.phase) * 0.012;
      const scaleOffset = 1 + Math.sin(time * (card.speed * 0.5) + card.phase) * 0.012;
      card.mesh.scale.set(scaleOffset, scaleOffset, 1);
    });

    clouds.forEach((cloud) => {
      cloud.mesh.position.x += Math.sin(time * cloud.speed + cloud.phase) * 0.002;
      cloud.mesh.position.y += Math.cos(time * (cloud.speed * 0.7) + cloud.phase) * 0.001;
    });

    sparkles.rotation.z = Math.sin(time * 0.08) * 0.04;

    for (const note of notes) {
      note.mesh.position.x += note.speed;
      note.mesh.position.y += Math.sin(time * 1.7 + note.wave) * 0.0015 + note.drift;
      note.mesh.rotation.y += note.spin;
      note.mesh.rotation.z += note.spin * 0.7;

      if (note.mesh.position.x > 7.2) {
        resetNote(note);
      }
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };
  animate();

  const onResize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) {
      return;
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  window.addEventListener('resize', onResize);

  cleanupHomeScene = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    boardFrameMaterial.dispose();
    boardInnerMaterial.dispose();
    for (const material of columnHeaderMaterials) {
      material.dispose();
    }
    for (const material of columnBodyMaterials) {
      material.dispose();
    }
    deskMaterial.dispose();
    laptopMaterial.dispose();
    backGlow.geometry.dispose();
    backGlow.material.dispose();
    for (const cloud of clouds) {
      cloud.mesh.geometry.dispose();
    }
    cloudMaterial.dispose();
    sparkleGeometry.dispose();
    sparkles.material.dispose();
    noteGeometry.dispose();
    for (const material of noteMaterials) {
      material.dispose();
    }
    for (const card of boardCards) {
      card.mesh.geometry.dispose();
      card.mesh.material.dispose();
    }
    host.innerHTML = '';
  };
}

export function onUnmountIndexPage() {
  if (cleanupHomeScene) {
    cleanupHomeScene();
    cleanupHomeScene = null;
  }
}