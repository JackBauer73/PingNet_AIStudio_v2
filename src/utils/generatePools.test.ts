import { test } from 'node:test';
import assert from 'node:assert';
import { generatePools } from './generatePools';
import { Player } from '../types';

// Helper pour créer un joueur fictif
function createMockPlayer(id: string, lastName: string, firstName: string, club: string | null, points: number): Player {
  return {
    id,
    tournament_id: 't1',
    last_name: lastName,
    first_name: firstName,
    club,
    serie: 'N1',
    points,
    phone: null,
    registered_at: new Date().toISOString()
  };
}

test('generatePools - 9 joueurs -> 3 poules de 3', () => {
  const players = [
    createMockPlayer('p1', 'Dupont', 'A', 'Club A', 685),
    createMockPlayer('p2', 'Blanc', 'B', 'Club B', 620),
    createMockPlayer('p3', 'Simon', 'C', 'Club C', 580),
    createMockPlayer('p4', 'Durand', 'D', 'Club D', 490),
    createMockPlayer('p5', 'Martin', 'E', 'Club E', 450),
    createMockPlayer('p6', 'Noir', 'F', 'Club F', 380),
    createMockPlayer('p7', 'Leroy', 'G', 'Club G', 320),
    createMockPlayer('p8', 'Petit', 'H', 'Club H', 210),
    createMockPlayer('p9', 'Morin', 'I', 'Club I', 150)
  ];

  const pools = generatePools(players, []);
  
  assert.strictEqual(pools.length, 3);
  assert.strictEqual(pools[0].players.length, 3);
  assert.strictEqual(pools[1].players.length, 3);
  assert.strictEqual(pools[2].players.length, 3);
});

test('generatePools - 10 joueurs -> 2 poules de 3 + 2 poules de 2', () => {
  const players = Array.from({ length: 10 }, (_, i) => 
    createMockPlayer(`p${i}`, `Player${i}`, `${i}`, null, 100 + i * 50)
  );

  const pools = generatePools(players, []);
  
  assert.strictEqual(pools.length, 4);
  
  const lengths = pools.map(p => p.players.length).sort();
  assert.deepStrictEqual(lengths, [2, 2, 3, 3]);
});

test('generatePools - 12 joueurs -> 4 poules de 3', () => {
  const players = Array.from({ length: 12 }, (_, i) => 
    createMockPlayer(`p${i}`, `Player${i}`, `${i}`, null, 100 + i * 50)
  );

  const pools = generatePools(players, []);
  
  assert.strictEqual(pools.length, 4);
  pools.forEach(p => {
    assert.strictEqual(p.players.length, 3);
  });
});

test('generatePools - Séparation des joueurs du même club', () => {
  // Test avec Dupont (ASPTT), Durand (ASPTT), Leroy (ASPTT)
  // On s'attend à ce que l'algorithme les sépare dans des poules distinctes si possible
  const players = [
    createMockPlayer('p1', 'Dupont', 'A', 'ASPTT', 680), // ASPTT
    createMockPlayer('p2', 'Durand', 'B', 'ASPTT', 650), // ASPTT
    createMockPlayer('p3', 'Leroy', 'C', 'ASPTT', 610),  // ASPTT
    createMockPlayer('p4', 'Blanc', 'D', 'PPC', 580),
    createMockPlayer('p5', 'Noir', 'E', 'PPC', 520),
    createMockPlayer('p6', 'Martin', 'F', 'USC', 480),
    createMockPlayer('p7', 'Simon', 'G', 'USC', 410),
    createMockPlayer('p8', 'Petit', 'H', 'CSM', 310),
    createMockPlayer('p9', 'Morin', 'I', 'CSM', 190)
  ];

  const pools = generatePools(players, []);
  
  assert.strictEqual(pools.length, 3);
  
  // Vérifier qu'il n'y a plus de doublon ASPTT au sein de la même poule
  pools.forEach((pool, idx) => {
    const aspttPlayers = pool.players.filter(p => p.club === 'ASPTT');
    assert.ok(aspttPlayers.length <= 1, `La poule ${idx} a trop de joueurs ASPTT: ${aspttPlayers.length}`);
  });
});

test('generatePools - Cas de club impossible à séparer', () => {
  // 5 joueurs d'ASPTT sur 6 joueurs au total.
  // Impossible d'éviter les doublons. On vérifie que console.warn est déclenché sans crasher.
  const players = [
    createMockPlayer('p1', 'Dupont', 'A', 'ASPTT', 600),
    createMockPlayer('p2', 'Durand', 'B', 'ASPTT', 550),
    createMockPlayer('p3', 'Leroy', 'C', 'ASPTT', 500),
    createMockPlayer('p4', 'Martin', 'D', 'ASPTT', 450),
    createMockPlayer('p5', 'Morin', 'E', 'ASPTT', 400),
    createMockPlayer('p6', 'Blanc', 'F', 'PPC', 300)
  ];

  let warnCalled = false;
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warnCalled = true;
    originalWarn(...args);
  };

  try {
    const pools = generatePools(players, []);
    assert.strictEqual(pools.length, 2);
    assert.ok(warnCalled, "console.warn aurait dû être déclenché car la séparation était impossible");
  } finally {
    console.warn = originalWarn;
  }
});
