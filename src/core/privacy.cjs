const fs=require('node:fs');
const {clearPreparedCalendars}=require('./calendar.cjs');
async function disconnectLocalAccount(store, accountPath, eventCache) {
  store.disconnectCloud();
  for(const file of [accountPath,accountPath+'.tmp']) if(fs.existsSync(file))fs.unlinkSync(file);
  await eventCache.reset(); clearPreparedCalendars();
}
module.exports={disconnectLocalAccount};
