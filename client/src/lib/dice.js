const rollD6  = () => Math.ceil(Math.random() * 6);
const rollDie = n  => Math.ceil(Math.random() * n);

export function computeRoll({ statValue, bonus, hard, risky, divineAgony, pathos }) {
  const threshold   = hard ? 6 : 4;
  const naturalPool = Math.min(statValue + bonus, 6);
  const finalPool   = divineAgony ? naturalPool + pathos : naturalPool;

  let mainDice = [], zeroDice = null;

  if (finalPool === 0) {
    const d1 = rollD6(), d2 = rollD6();
    zeroDice = [d1, d2];
    mainDice = [Math.min(d1, d2)];
  } else {
    for (let i = 0; i < finalPool; i++) mainDice.push(rollD6());
  }

  const success = mainDice.some(d => d >= threshold);

  let riskDie = null, riskLabel = null;
  if (risky) {
    riskDie   = rollD6();
    riskLabel = riskDie === 1 ? 'Terrible'
              : riskDie <= 3 ? 'Bad'
              : riskDie <= 5 ? 'Expected'
              : 'Good';
  }

  return { mainDice, zeroDice, success, riskDie, riskLabel, threshold, finalPool };
}

export function computeCustomRoll({ d6Count, d3Count }) {
  const d6Dice = Array.from({ length: d6Count }, rollD6);
  const d3Dice = Array.from({ length: d3Count }, () => rollDie(3));
  return { d6Dice, d3Dice, finalPool: d6Count + d3Count };
}
