import { eq } from 'drizzle-orm';
import { db } from './client';
import { biblias, diccionario, libros, versiculos } from './schema';

async function seed() {
  const [createdBiblia] = await db
    .insert(biblias)
    .values({
      slug: 'spapddpt',
      nombre: 'Palabra de Dios para ti',
      idioma: 'es',
      licencia: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
      fuente: 'eBible.org — https://ebible.org/find/details.php?id=spapddpt',
    })
    .onConflictDoNothing()
    .returning();

  const biblia = createdBiblia ?? (await db.select().from(biblias).where(eq(biblias.slug, 'spapddpt')).get());
  if (!biblia) throw new Error('No se pudo crear ni recuperar la Biblia spapddpt.');

  const [createdGenesis] = await db
    .insert(libros)
    .values({ testamento: 'AT', nombre: 'Génesis', slug: 'genesis', abreviatura: 'Gn', orden: 1 })
    .onConflictDoNothing()
    .returning();

  const genesis = createdGenesis ?? (await db.select().from(libros).where(eq(libros.slug, 'genesis')).get());
  if (!genesis) throw new Error('No se pudo crear ni recuperar el libro Génesis.');

  await db
    .insert(versiculos)
    .values([
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 1, texto: 'En un principio ʼElohim creó los cielos y la tierra.' },
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 2, texto: 'La tierra estaba desordenada y vacía, y las tinieblas estaban sobre la superficie del abismo. El Espíritu de ʼElohim se movía sobre la superficie de las aguas.' },
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 3, texto: 'Entonces ʼElohim dijo: Haya luz. Y hubo luz.' },
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 4, texto: 'ʼElohim vio que la luz era buena, y ʼElohim separó la luz de las tinieblas.' },
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 5, texto: 'ʼElohim llamó a la luz Día, y a las tinieblas llamó Noche. Y fue la tarde y fue la mañana: día uno.' },
    ])
    .onConflictDoNothing();

  await db
    .insert(diccionario)
    .values([
      { codigoStrong: 'H7225', palabra: 'principio', definicion: 'Comienzo, primero o punto de origen.' },
      { codigoStrong: 'H430', palabra: 'Dios', definicion: 'Elohim; término hebreo usado para Dios en Génesis.' },
    ])
    .onConflictDoNothing();

  console.info('Seed spapddpt completado correctamente.');
}

seed().catch((error) => {
  console.error('Error ejecutando seed:', error);
  process.exitCode = 1;
});
