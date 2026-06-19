const { calculateBottleneckForecast } = require('./src/server/forecast/bottleneckDetection');
const { calculateSLAForecast } = require('./src/server/forecast/slaEngine');
const { calculatePlantRisk } = require('./src/server/forecast/plantRisk');
const { calculateVendorRiskForecast } = require('./src/server/forecast/vendorRisk');

async function run() {
  const liveRows = [
    { currentStage: 'READY' },
    { currentStage: 'LATHE' },
    { currentStage: 'LATHE' },
    { currentStage: 'VA' },
  ];
  
  const dbRows = [
    { sc: '1', po: 'PO1', product: 'P1', currentStage: 'M1', timestamp: '2026-06-01 10:00:00' },
    { sc: '1', po: 'PO1', product: 'P1', currentStage: 'LATHE', timestamp: '2026-06-02 10:00:00' },
    { sc: '2', po: 'PO2', product: 'P2', currentStage: 'LATHE', timestamp: '2026-06-01 10:00:00' },
  ];

  try {
    const pRisk = await calculatePlantRisk({ liveRows, dbRows });
    console.log("Plant Risk Result:", JSON.stringify(pRisk, null, 2));

    const vRisk = await calculateVendorRiskForecast({ liveRows, dbRows });
    console.log("Vendor Risk Result:", JSON.stringify(vRisk, null, 2));
  } catch (error) {
    console.error("Forecast Error:", error);
  }
}

run();
