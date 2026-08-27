/**
 * One-off migration: tasks written before the multi-assignee change store a single
 * ObjectId in `assignedTo`; this wraps each of those values in a one-element array.
 *
 *   npm run migrate:multi-assignee
 *
 * The application reads both shapes, so running this is cleanup rather than a
 * prerequisite — but do NOT run it while an old (single-assignee) build is still
 * serving this database, because that build cannot read array values.
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Task } from '../models/Task.js';

const run = async () => {
  await connectDatabase();

  const result = await Task.collection.updateMany(
    { assignedTo: { $type: 'objectId' } },
    [{ $set: { assignedTo: ['$assignedTo'] } }],
  );

  console.log(`· Tasks migrated to assignee arrays: ${result.modifiedCount}`);

  await disconnectDatabase();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('✖ Migration failed:', error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
