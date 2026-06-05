import { seedPlanLectura } from '../src/db/seed-plan-lectura';

seedPlanLectura()
  .then(() => {
    console.info('Seed plan_lectura completado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error en seed plan_lectura:', error);
    process.exit(1);
  });
