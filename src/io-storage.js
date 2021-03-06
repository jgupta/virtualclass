var ioStorage = {

  dataAdapterStore(allData, serialKey) {
    // TODO To be removed
    if (typeof virtualclass.storage === 'object' && typeof virtualclass.storage.db === 'object') {
      virtualclass.storage.dataAdapterAllStore(JSON.stringify(allData), serialKey);
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
    // TODO To be removed
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

  dataExecutedStoreAll(DataExecutedAll, serialKey) {
    virtualclass.storage.dataExecutedStoreAll(JSON.stringify(DataExecutedAll), serialKey);
  },

  dataExecutedUserStoreAll(DataExecutedUserAll, serialKey) {
    virtualclass.storage.dataExecutedUserStoreAll(JSON.stringify(DataExecutedUserAll), serialKey);
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
    const msg = ioStorage.addUserObj(data);
    virtualclass.storage.storeCacheAll(JSON.stringify(msg), key);
  },

  storeCacheOutData(data, key) {
    const msg = ioStorage.addUserObj(data);
    virtualclass.storage.storeCacheOut(JSON.stringify(msg), key);
  },

  addUserObj(msg) {
    if (!Object.prototype.hasOwnProperty.call(msg, 'type') && Object.prototype.hasOwnProperty.call(msg, 'user')) {
      msg.type = 'broadcastToAll';
      if (typeof virtualclass.gObj.allUserObj[msg.user.userid] === 'undefined') {
        virtualclass.gObj.allUserObj[msg.user.userid] = {};
        virtualclass.gObj.allUserObj[msg.user.userid].userid = msg.user.userid;
        virtualclass.gObj.allUserObj[msg.user.userid].lname = ' ';
        virtualclass.gObj.allUserObj[msg.user.userid].name = 'student';
        virtualclass.gObj.allUserObj[msg.user.userid].role = 's';
      }

      if (virtualclass.gObj.allUserObj[msg.user.userid].userid == msg.user.userid) {
        msg.user.lname = virtualclass.gObj.allUserObj[msg.user.userid].lname;
        msg.user.name = virtualclass.gObj.allUserObj[msg.user.userid].name;
        msg.user.role = virtualclass.gObj.allUserObj[msg.user.userid].role;
      }
    }
    return msg;
  },

  storeCacheInData(data, key) {
    virtualclass.storage.storeCacheIn(JSON.stringify(data), key);
  },
};
