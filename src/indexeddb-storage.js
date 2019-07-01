// This file is part of Vidyamantra - http:www.vidyamantra.com/
/** @Copyright 2014  Vidya Mantra EduSystems Pvt. Ltd.
 * @author  Suman Bogati <http://www.vidyamantra.com>
 */
(function (window) {
  "use strict";
  let that;
  let mycacheQueue = [];
  let dataStore = false;
  let dataAllStore = false;
  let storeFirstObj = false;
  const mc = false;

  const storage = {
    //  totalStored: (totalDataStored == null) ? 0 : JSON.parse(totalDataStored),
    version: 12,
    async init() {
      /** *
       * Which table, what doing
       executedStoreAll => To store the executed data of users till now
       dataAdapterAll => To store the must data of all user.
       dataUserAdapterAll =>  To Store the must data of all user on particular user
       wbData => To store the whiteboard data.
       By which, we calculate the time(after 48 hour we are
       ending the session for that particular room)
       executedUserStoreAll => for store the missed packet of according to user.
       */

      that = this;
      this.tables = [
        // 'wbData',
        'dataAdapterAll',
        'dataUserAdapterAll',
        'executedStoreAll',
        'executedUserStoreAll',
        'dstdata',
        'pollStorage',
        'quizData',
        'dstall',
        'cacheAll',
        'cacheOut',
        'cacheIn',
      ];

      this.db = await virtualclass.virtualclassIDBOpen('vidya_apps', that.dbVersion, {
        upgrade(db) {
          that.onupgradeneeded(db);
        },
      });

      if (typeof this.db.objectStoreNames === 'object' && this.db.objectStoreNames != null) {
        await this.onsuccess();
      } else {
        this.init();
      }
    },

    onupgradeneeded(db) {
      const thisDb = db;

      // if (!thisDb.objectStoreNames.contains('wbData')) {
      //   thisDb.createObjectStore('wbData', { keyPath: 'did' });
      // }

      if (!thisDb.objectStoreNames.contains('dataAdapterAll')) {
        thisDb.createObjectStore('dataAdapterAll', { keyPath: 'serialKey' });
      }

      if (!thisDb.objectStoreNames.contains('dataUserAdapterAll')) {
        thisDb.createObjectStore('dataUserAdapterAll', { keyPath: 'serialKey' });
      }

      if (!thisDb.objectStoreNames.contains('executedStoreAll')) {
        thisDb.createObjectStore('executedStoreAll', { keyPath: 'serialKey' });
      }

      if (!thisDb.objectStoreNames.contains('executedUserStoreAll')) {
        thisDb.createObjectStore('executedUserStoreAll', { keyPath: 'serialKey' });
      }

      if (!thisDb.objectStoreNames.contains('dstdata')) {
        thisDb.createObjectStore('dstdata', { keyPath: 'timeStamp', autoIncrement: true });
      }

      if (!thisDb.objectStoreNames.contains('pollStorage')) {
        thisDb.createObjectStore('pollStorage', { keyPath: 'timeStamp', autoIncrement: true });
      }

      if (!thisDb.objectStoreNames.contains('quizData')) {
        thisDb.createObjectStore('quizData', { keyPath: 'quizkey' });
      }

      if (!thisDb.objectStoreNames.contains('dstall')) {
        thisDb.createObjectStore('dstall', { keyPath: 'timeStamp', autoIncrement: true });
      }

      if (!thisDb.objectStoreNames.contains('cacheAll')) {
        thisDb.createObjectStore('cacheAll');
      }

      if (!thisDb.objectStoreNames.contains('cacheOut')) {
        thisDb.createObjectStore('cacheOut');
      }

      if (!thisDb.objectStoreNames.contains('cacheIn')) {
        thisDb.createObjectStore('cacheIn');
      }
    },

    async onsuccess() {
      await this.getAllObjs();
    },

    // store(data) {
    //   const tx = that.db.transaction('wbData', 'readwrite');
    //   tx.store.put({ repObjs: data, did: virtualclass.gObj.currWb, id: 1 });
    //   tx.done.then(() => {
    //      console.log('success')
    //   }, () => {
    //     console.log('failure');
    //   });
    // },


    pollStore(store) {
      const tx = that.db.transaction('pollStorage', 'readwrite');
      tx.store.add({ pollResult: store, currTime: new Date().getTime(), id: 1 });
      tx.done.then(() => {
        console.log('success');
      }, () => {
        console.log('failure');
      });
    },

    // wbDataRemove(key) {
    //   console.log('Whiteboard data remove');
    //   const tx = that.db.transaction(['wbData'], 'readwrite');
    //   tx.store.delete(key);
    // },

    async dataExecutedStoreAll(data, serialKey) {
      console.log("==== indexedb, dataExecutedAllStore,  data ", data);
      const tx = that.db.transaction('executedStoreAll', 'readwrite');
      tx.store.put({ executedData: data, id: 6, serialKey });
      tx.done.then(() => {
        console.log('success');
      }, () => {
        console.log('failure');
      });

      /** TODO, this should be enable * */

      // t.onerror = function ( e ) {
      //     // prevent Firefox from throwing a ConstraintError and aborting (hard)
      //     e.preventDefault();
      // }
    },

    dataAdapterAllStore(data, serialKey) {
      console.log("==== indexedb, dataAdapterAllStore,  data ", data);
      const tx = that.db.transaction('dataAdapterAll', 'readwrite');
      tx.store.put({ adaptData: data, id: 5, serialKey });
      tx.done.then(() => {
        // console.log('success')
      }, () => {
        console.log('failure');
      });
      /** TODO, this should be enable * */
      // t.onerror = function ( e ) {
      //     // prevent Firefox from throwing a ConstraintError and aborting (hard)
      //     e.preventDefault();
      // }
    },

    storeCacheAll(data, serialKey) {
      if (virtualclass.config.makeWebSocketReady) {
        const tx = that.db.transaction('cacheAll', 'readwrite');
        serialKey[0] = parseInt(serialKey[0]);
        serialKey[1] = parseInt(serialKey[1]);

        tx.store.put(data, serialKey);
        tx.done.then(() => {
          console.log('success');
        }, () => {
          console.log('failure');
        });
      }
    },


    storeCacheOut(data, serialKey) {
      const tx = that.db.transaction('cacheOut', 'readwrite');
      tx.store.put(data, serialKey);
      tx.done.then(() => {
        console.log('success');
      }, () => {
        console.log('failure');
      });
    },

    storeCacheIn(data, serialKey) {
      const tx = that.db.transaction('cacheIn', 'readwrite');
      tx.store.put(data, serialKey);
      tx.done.then(() => {
        console.log('success');
      }, () => {
        console.log('failure');
      });
    },


    dataUserAdapterAllStore(data, serialKey) {
      const tx = that.db.transaction('dataUserAdapterAll', 'readwrite');
      tx.store.put({ adaptUserData: data, id: 7, serialKey });
      tx.done.then(() => {
        console.log('success');
      }, () => {
        console.log('failure');
      });

      // hack for firefox
      // problem https://bugzilla.mozilla.org/show_bug.cgi?id=872873
      // solution https://github.com/aaronpowell/db.js/issues/98
      // TODO, this should be enable
      // t.onerror = function ( e ) {
      //     // prevent Firefox from throwing a ConstraintError and aborting (hard)
      //     e.preventDefault();
      // }
    },


    dataExecutedUserStoreAll(data, serialKey) {
      console.log("==== indexedb, dataExecutedUserStoreAll,  data ", data);
      const tx = that.db.transaction('executedUserStoreAll', 'readwrite');
      tx.store.put({ executedUserData: data, id: 8, serialKey });
      tx.done.then(() => {
        console.log('success');
      }, () => {
        console.log('failure');
      });

      // t.onerror = function ( e ) {
      //     // prevent Firefox from throwing a ConstraintError and aborting (hard)
      //     e.preventDefault();
      // }
    },

    quizStorage(quizkey, data) {
      const tx = that.db.transaction('quizData', 'readwrite');
      tx.store.put({ qzData: data, quizkey });
      tx.done.then(() => {
        console.log('success');
      }, () => {
        console.log('failure');
      });
    },

    async getAllObjs() {
      await Promise.all([
        // this.getDataFromTable('wbData'),
        this.getDataFromTable('dataAdapterAll'),
        this.getDataFromTable('dataUserAdapterAll'),
        this.getDataFromTable('executedStoreAll'),
        this.getDataFromTable('executedUserStoreAll'),
        this.getDataFromTable('dstdata'),
        this.getDataFromTable('dstall'),
        // this.getDataFromTable('cacheAll'),
      ]);
    },

    async getDataFromcacheAll() {
      let cursor = await this.db.transaction('cacheAll').store.openCursor();
      while (cursor) {
        if (cursor.value) {

          if (!Array.isArray(mycacheQueue[cursor.key[0]])) {
            mycacheQueue[cursor.key[0]] = [];
          }
          mycacheQueue[parseInt(cursor.key[0])][parseInt(cursor.key[1])] = cursor.value;
          // if (!Array.isArray(mycacheQueue[cursor.key[0] + cursor.key[1]])) {
          //   mycacheQueue[cursor.key[0] + cursor.key[1]] = [];
          // }
          // mycacheQueue[cursor.key[0] + cursor.key[1]].push(cursor.value);
          // ioAdapter.serial = cursor.key[1];
          // const event = { data: { msg: cursor.value, cmd: 'receivedJson' } };
          // await ioInit.onmessage(event);
        }
        cursor = await cursor.continue();
      }
      // setTimeout(() => {
      if (mycacheQueue.length > 0) {
        for (const key1 in mycacheQueue) {
          for (const key2 in mycacheQueue[key1]) {
            if (key1 === virtualclass.gObj.uid) {
              ioAdapter.serial = parseInt(key2, 10);
            }
            ioInit.onmessage({ data: { msg: mycacheQueue[key1][key2], cmd: 'receivedJson' } });
          }
        }
      }

      virtualclass.config.makeWebSocketReady = true;
      virtualclass.makeReadySocket();
      // }, 5000);


      // await this[table].handleResult(cursor);
    },

    async getDataFromTable(table) {
      const cursor = await this.db.transaction(table).store.openCursor();
      await this[table].handleResult(cursor);
    },

    async getAllDataOfPoll(table, cb) {
      const wholeData = [];
      let cursor = await that.db.transaction('pollStorage').store.openCursor();

      while (cursor) {
        console.log(cursor.key, cursor.value);
        wholeData.push(cursor.value);
        cursor = await cursor.continue();
      }

      if (wholeData.length > 0) {
        cb(wholeData);
      } else {
        console.log('No data fetched from indexedDb');
      }
    },

    // wbData: {
    //   async handleResult(cursor) {
    //     while (cursor) {
    //       if (cursor.value.hasOwnProperty('repObjs')) {
    //         if (typeof virtualclass.wb === 'object') {
    //           console.log(`Total Whiteboard Length ${JSON.parse(cursor.value.repObjs).length} From indexeddb`);
    //           virtualclass.wb[virtualclass.gObj.currWb].utility.replayFromLocalStroage(JSON.parse(cursor.value.repObjs));
    //         } else {
    //           virtualclass.gObj.tempReplayObjs._doc_0_0 = JSON.parse(cursor.value.repObjs);
    //         }
    //         storeFirstObj = true;
    //       }
    //
    //       cursor = await cursor.continue();
    //     }
    //
    //     if (!storeFirstObj && virtualclass.currApp === 'Whiteboard') {
    //       virtualclass.wb[virtualclass.gObj.currWb].utility.makeUserAvailable(); // at very first
    //     }
    //   },
    // },


    dataAdapterAll: {
      async handleResult(cursor) {

        // while (cursor) {
        //   if (cursor.value.hasOwnProperty('adaptData')) {
        //     const data = JSON.parse(cursor.value.adaptData);
        //     if (parseInt(cursor.value.serialKey) > ioAdapter.serial) {
        //       ioAdapter.serial = parseInt(cursor.value.serialKey);
        //     }
        //     // debugger;
        //     ioAdapter.adapterMustData[ioAdapter.serial] = data;
        //   }
        //   cursor = await cursor.continue();
        // }
      },
    },

    cacheAll : {
        async handleResult(cursor) {
        if (cursor) {

          if (cursor.value) {
            ioAdapter.serial = cursor.key[1];
            const event = {data:{msg : cursor.value, cmd : 'receivedJson'}};
            await ioInit.onmessage(event);
          }
          cursor = await cursor.continue();
          this.handleResult(cursor);
        } else {
          virtualclass.config.makeWebSocketReady = true;
          console.log('==== how many times');
          virtualclass.makeReadySocket();
        }
      },
    },

    cacheOut : {
      async handleResult(cursor) {
        while (cursor) {
          console.log("someting happend");
          cursor = await cursor.continue();
        }
      }
    },

    dataUserAdapterAll: {
      async handleResult(cursor) {
        while (cursor) {
          if (cursor.value.hasOwnProperty('adaptUserData')) {
            const data = JSON.parse(cursor.value.adaptUserData);
            const usKey = cursor.value.serialKey.split('_');
            const uid = parseInt(usKey[0]); const
              serial = parseInt(usKey[1]);
            ioAdapter.validateAllVariables(uid);
            if (serial > ioAdapter.userSerial[uid]) {
              ioAdapter.userSerial[uid] = serial;
            }

            ioAdapter.userAdapterMustData[uid][serial] = data;
          }
          cursor = await cursor.continue();
        }
      },
    },


    executedStoreAll: {
      async handleResult(cursor) {
        while (cursor) {
          if (cursor.value.hasOwnProperty('executedData')) {
            const data = JSON.parse(cursor.value.executedData);
            // ioMissingPackets.executedSerial = cursor.value.serialKey;
            const akey = cursor.value.serialKey.split('_');
            const uid = parseInt(akey[0]); const
              serial = parseInt(akey[1]);
            ioMissingPackets.validateAllVariables(uid);
            ioMissingPackets.executedStore[uid][serial] = data;
            // console.log('till now executed ' + cursor.value.serialKey);
          }
          cursor = await cursor.continue();
        }
      },
    },


    executedUserStoreAll: {
      async handleResult(cursor) {
        while (cursor) {
          if (cursor.value.hasOwnProperty('executedUserData')) {
            const data = JSON.parse(cursor.value.executedUserData);

            // ioMissingPackets.executedSerial = cursor.value.serialKey;
            const akey = cursor.value.serialKey.split('_');
            const uid = parseInt(akey[0]); const
              serial = parseInt(akey[1]);

            ioMissingPackets.validateAllUserVariables(uid);

            ioMissingPackets.executedUserStore[uid][serial] = data;
          }
          cursor = await cursor.continue();
        }
      },
    },

    // Store for document sharing data
    dstdata: {
      async handleResult(cursor) {
        while (cursor) {
          if (cursor.value.hasOwnProperty('alldocs')) {
            console.log('document share store');
            dataStore = true;
            virtualclass.gObj.docs = JSON.parse(cursor.value.alldocs);
            // virtualclass.gObj.docs = 'init';
          }
          cursor = await cursor.continue();
        }

        if (!dataStore) {
          virtualclass.gObj.docs = 'init';
          console.log('==== Docs init ');
        }
      },
    },

    dstAllStore(data) {
      const tx = this.db.transaction('dstall', 'readwrite');
      tx.store.clear();

      const allNotes = JSON.stringify(virtualclass.dts.allNotes);
      tx.store.add({
        dstalldocs: JSON.stringify(data),
        allNotes,
        timeStamp: new Date().getTime(),
        id: 10,
      });
      tx.done.then(() => {
        console.log('success');
      }, () => {
        console.log('failure');
      });
    },

    dstall: {
      async handleResult(cursor) {
        while (cursor) {
          if (cursor.value.hasOwnProperty('dstalldocs')) {
            console.log('document share store');
            dataAllStore = true;
            // We are not getting the data from local storage for now
            virtualclass.gObj.dstAll = JSON.parse(cursor.value.dstalldocs);
            virtualclass.gObj.dstAllNotes = JSON.parse(cursor.value.allNotes);
          }
          cursor = await cursor.continue();
        }

        if (!dataAllStore) {
          console.log('document share store init');
          virtualclass.gObj.dstAll = 'init';
        }
      },
    },

    clearSingleTable(table, lastTable) {
      console.log('Clear single table ', table);

      const tx = this.db.transaction(table, 'readwrite');
      tx.store.clear();

      if (typeof lastTable !== 'undefined') {
        lastTable();
      }

      // if we clear the indexed db then we need to
      // that docs to be init
      if (table == 'dstdata') {
        virtualclass.gObj.docs = 'init';
        console.log('==== Docs init ');
      }

      if (table == 'dstall') {
        virtualclass.gObj.dstall = 'init';
      }
    },

    async clearStorageData() {
      ioAdapter.adapterMustData = [];
      ioAdapter.serial = -1;
      ioAdapter.userSerial = [];
      ioAdapter.userAdapterMustData = [];
      ioMissingPackets.executedStore = [];
      ioMissingPackets.executedSerial = {};
      ioMissingPackets.missRequest = [];
      ioMissingPackets.aheadPackets = [];
      ioMissingPackets.missRequestFlag = 0;
      ioMissingPackets.executedUserStore = [];
      ioMissingPackets.executedUserSerial = {};
      ioMissingPackets.missUserRequest = [];
      ioMissingPackets.aheadUserPackets = [];
      ioMissingPackets.missUserRequestFlag = 0;
      await Promise.all([
        // this.clearSingleTable('wbData'),
        this.clearSingleTable('dataAdapterAll'),
        this.clearSingleTable('dataUserAdapterAll'),
        this.clearSingleTable('executedStoreAll'),
        this.clearSingleTable('executedUserStoreAll'),
        this.clearSingleTable('dstdata'),
        this.clearSingleTable('pollStorage'),
        this.clearSingleTable('quizData'),
        this.clearSingleTable('dstall'),
        this.clearSingleTable('cacheAll'),
        this.clearSingleTable('cacheIn'),
        this.clearSingleTable('cacheOut'),
      ]);
      if (virtualclass.gObj.hasOwnProperty('sessionEndResolve')) {
        virtualclass.gObj.sessionEndResolve();
      }
    },

    clearLastTable() {
      if (virtualclass.gObj.hasOwnProperty('sessionEndResolve')) {
        virtualclass.gObj.sessionEndResolve();
      }
    },

    // Get quiz data, store in array based on
    // key and then return array of object
    async getQuizData(cb) {
      const dataArr = [];
      let cursor = await this.db.transaction('quizData').store.openCursor();
      while (cursor) {
        const qdata = cursor.value;
        dataArr[cursor.value.quizkey] = cursor.value.qzData;
        cursor = await cursor.continue();
      }

      cb(dataArr);
    },

    // Clear all data from given table
    clearTableData(table) {
      const tx = this.db.transaction(table, 'readwrite');
      tx.store.clear();
    },

    // get whiteboard data accoring to whieboard id

    // async getWbData(wbId) {
    //   const tx = await this.db.transaction('wbData', 'readwrite');
    //   const store = tx.objectStore('wbData');
    //   const wb = await store.get(wbId);
    //
    //   if (typeof wb !== 'undefined') {
    //     console.log(`Whiteboard start store from local storage ${wbId}`);
    //     virtualclass.gObj.tempReplayObjs[wbId] = [];
    //     virtualclass.gObj.tempReplayObjs[wbId] = JSON.parse(wb.repObjs);
    //   } else {
    //     virtualclass.gObj.tempReplayObjs[wbId] = 'nodata';
    //   }
    // },

  };
  window.storage = storage;
}(window));
