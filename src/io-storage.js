var ioStorage = {

  dataAdapterStore(allData, serialKey) {
    if (typeof virtualclass.storage === 'object' && typeof virtualclass.storage.db === 'object') {
      virtualclass.storage.dataAdapterAllStore(JSON.stringify(allData), serialKey);
      // virtualclass.storage.storeMustData(JSON.stringify(allData), serialKey);
      // ioStorage.mustDataStore(JSON.stringify(allData), [virtualclass.gObj.uid, serialKey]);
      // virtualclass.storage.storeMustData(JSON.stringify(allData), [virtualclass.gObj.uid, serialKey]);
    } else {
      setTimeout(
        () => {
          ioStorage.dataAdapterStore(allData, serialKey); // if table of indexeddb is not ready yet.
        },
        10,
      );
    }
  },

  dataUserAdapterMustData(allData, serialKey) {
    // debugger;
    if (typeof virtualclass.storage === 'object' && typeof virtualclass.storage.db === 'object') {
      virtualclass.storage.dataUserAdapterAllStore(JSON.stringify(allData), serialKey);
    } else {
      setTimeout(
        () => {
          // debugger;
          ioStorage.dataUserAdapterMustData(allData, serialKey); // if table of indexeddb is not ready yet.
        },
        10,
      );
    }
  },

  dataExecutedStoreAll(DataExecutedAll, serialKeyWithUser) {
    virtualclass.storage.dataExecutedStoreAll(JSON.stringify(DataExecutedAll), serialKeyWithUser);
  },

  storeCacheAllDataSend(data, key) {
    const msg = {
      user: { userid: wbUser.id },
      m: data.arg.msg,
    };
    msg.user.lname = virtualclass.gObj.allUserObj[virtualclass.gObj.uid].lname;
    msg.user.name = virtualclass.gObj.allUserObj[virtualclass.gObj.uid].name;
    msg.user.role = virtualclass.gObj.allUserObj[virtualclass.gObj.uid].role;
    msg.type = 'broadcastToAll';
    virtualclass.storage.storeCacheAll(JSON.stringify(msg), key);
  },

  storeCacheAllData(data, key) {
    virtualclass.storage.storeCacheAll(JSON.stringify(data), key);
  },

  storeCacheOutData(data, key) {
    virtualclass.storage.storeCacheOut(data, key);
  },

  storeCacheInData(data, key) {
    virtualclass.storage.storeCacheIn(JSON.stringify(data), key);
  },

  dataExecutedUserStoreAll(DataExecutedUserAll, serialKey) {
    virtualclass.storage.dataExecutedUserStoreAll(JSON.stringify(DataExecutedUserAll), serialKey);
  },

};
