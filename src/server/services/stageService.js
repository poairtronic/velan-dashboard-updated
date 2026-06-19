const { getSCLastTimestamp, daysBetween, TARGET_DAYS } = require('../../utils/calculationUtils');

function calculateStages({ filtered, poGroups, todayStr }) {
  const stageWIP = {};
  filtered.forEach((row) => {
    const stage = row.currentStage;
    if (!stageWIP[stage]) stageWIP[stage] = 0;
    stageWIP[stage]++;
  });

  const stageCounts = {};
  filtered.forEach((r) => {
    stageCounts[r.currentStage] = (stageCounts[r.currentStage] || 0) + 1;
  });

  return {
    stageWIP,
    stageCounts,
  };
}

module.exports = { calculateStages };
